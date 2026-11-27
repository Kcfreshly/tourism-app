# Verified activity reviews

Status: Approved (all phases, recommendations R1–R8 as written) — 2026-11-22
Date: 2026-11-22
Scope: reviews for experiences (activities) in the Next.js app: data model,
`/api/v1` endpoints, experience page, overlay, Explore cards, "My bookings" and
the staff panel. Packages are out of scope for the first version.

## 1. Current state

- **Nothing records a purchase yet.** The cart is browser-only
  (`src/modules/bookings/domain/cart.ts`, `storeKeys.cart`), the Pay buttons
  are disabled, and there is no `orders` or `bookings` table (tables today:
  catalogue, packages, media, trips, planner_proposals, account_buckets,
  partners, listing_submissions, listing_visits, audit_events, auth tables).
- **The payments plan supplies what reviews need.**
  `docs/PAYMENT_INTEGRATION_PLAN.md` §3 adds `bookings` with an owner (via
  `orders.user_id`), `product_type`/`product_id`, `local_date`, `start_time`
  and a status that includes `COMPLETED` and `NO_SHOW`, plus
  `booking_status_history`. It does not yet say **who or what moves a booking
  to `COMPLETED`** (see R1).
- No review, rating or moderation code exists. Listings show no social proof.

So "genuinely purchased and completed" can only be enforced once payments
phase 5 ("My bookings") lands. Reviews are built on top of it, not beside it.

## 2. Problems to avoid

1. **Unverifiable reviews.** Any review not tied to a paid, completed booking
   can be faked. Eligibility must be checked on the server from `bookings`,
   never from the client.
2. **Unbounded review lists.** A popular listing can collect thousands of
   reviews; the experience page must page them, not load them all.
3. **Client-side averages.** Cards in Explore must not fetch reviews to compute
   a star rating. The average and count are stored per listing and updated when
   a review is written.
4. **Review stuffing.** One person booking the same activity five times should
   not produce five ratings.

## 3. Design principles here

- **Eligibility = a booking the reviewer owns, for this listing, in status
  `COMPLETED`.** `NO_SHOW`, `CANCELLED`, `DECLINED`, `AWAITING_PARTNER` and
  `CONFIRMED` (not yet happened) are not eligible.
- **One review per traveller per listing** (R2). A later completed booking lets
  them update it rather than add another.
- **Window:** a review can be written up to 90 days after the activity
  (labelled starting default, R4).
- **Publish first, moderate after** (R3): a review appears at once; staff can
  hide it with a reason. Hidden reviews leave the average.
- **Summary is precomputed** in `review_summaries`, updated in the same
  transaction as the review write.

## 4. Target endpoint catalog

All responses use the existing `{ data, meta }` / `{ error }` envelope.

### `GET /api/v1/experiences/{id}/reviews` — public list

- Consumer: experience page and overlay ("See all reviews").
- Params: `sort` = `recent` (default) | `highest` | `lowest`; `cursor`;
  `limit` default 10, max 50 (422 above). Cursor (keyset) pagination on
  `(published_at, id)` or `(rating, published_at, id)`: reviews are append-heavy.
- Response: `{ data: { items: [{ id, rating, title, body, author: "Ada O.",
activityDate: "2026-12", createdAt, updatedAt? }], nextCursor } }`.
  About 1–2 KB per review, so ≤ 100 KB at max limit.
- Public read, cacheable: `Cache-Control: public, s-maxage=60,
stale-while-revalidate=300`. Throttle per IP (`reviews-read:{ip}`, 120).
- Only `PUBLISHED` reviews; no reviewer ids or emails.

### Rating summary — no new endpoint

`review_summaries` is read with the listing: the experience page
(server-rendered, via `pages`) and the published catalogue used by Explore
gain `rating: { average, count } | null` (null under 3 reviews, R5). The
experience page also gets the 1–5 histogram. This adds about 40 bytes per card.

### `POST /api/v1/experiences/{id}/review` — write or replace my review

- Consumer: "Leave a review" on My bookings and on the experience page when
  eligible.
- Body: `{ rating: 1–5 integer, title?: ≤ 80 chars, body: 20–2000 chars }`.
- Server: require sign-in and origin check; find the actor's most recent
  `COMPLETED` booking for this listing inside the window; upsert the actor's
  review for the listing (`UNIQUE (user_id, product_id)`), link the booking,
  update `review_summaries`, write an audit event — one transaction.
- Errors: 401 signed out; 403 `NOT_ELIGIBLE` ("You can review this after
  you've done it.") or `REVIEW_WINDOW_CLOSED`; 422 `INVALID_REVIEW`; 409
  `CONFLICT` on a stale `expectedVersion` when editing.
- Throttle `review-write:{actor}`, 10.

### `DELETE /api/v1/experiences/{id}/review` — remove my review

- Same auth and throttle. Removes it and updates the summary.

### Eligibility for the UI — no new endpoint

- **My bookings** (payments phase 5, `GET /api/v1/orders`): each booking gains
  `review: { state: "CAN_REVIEW" | "REVIEWED" | "CLOSED" | "NOT_YET", reviewId? }`.
- **Experience page:** the server render adds `myReview` and `canReview` for the
  signed-in viewer, so no extra client request.

### Staff: `GET /api/v1/admin/reviews`, `PATCH /api/v1/admin/reviews/{id}`

- List: filters `status` (`PUBLISHED` | `HIDDEN`), `experienceId`, `rating`;
  offset pagination, default 25, max 100 (a small staff table).
- Patch: `{ status: "HIDDEN" | "PUBLISHED", reason }`. Requires admin, writes an
  audit event and updates the summary. Throttle `review-moderate:{actor}`, 60.

## 5. Data layer — migration `0011_reviews.sql` (after payments' `0010`)

```sql
reviews (
  id uuid PK,
  user_id text NOT NULL,              -- auth_user.id
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE')),
  product_id text NOT NULL,           -- catalogue offer id
  booking_id uuid NOT NULL FK bookings,  -- the booking that made it eligible
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text, body text NOT NULL,
  author_name text NOT NULL,          -- "Ada O.", snapshotted at write
  activity_date date NOT NULL,        -- from the booking
  status text NOT NULL CHECK (status IN ('PUBLISHED','HIDDEN')),
  hidden_reason text,
  version int NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL, created_at, updated_at,
  UNIQUE (user_id, product_type, product_id)
);
CREATE INDEX reviews_listing_recent ON reviews (product_id, status, published_at DESC, id DESC);
CREATE INDEX reviews_listing_rating ON reviews (product_id, status, rating DESC, published_at DESC, id DESC);

review_summaries (
  product_type text, product_id text, PRIMARY KEY (product_type, product_id),
  review_count int NOT NULL, rating_sum int NOT NULL,
  histogram int[5] NOT NULL,          -- counts of 1..5 stars
  updated_at timestamptz
);
```

The summary row is locked (`FOR UPDATE`) and adjusted by delta on create,
update, delete, hide and unhide. A staff "recount" script rebuilds it if it ever
drifts.

Code follows the existing module layout: `src/modules/reviews/` with
`domain/review.ts` (validation, eligibility rule, author name),
`application/use-cases/` (write-review, delete-review, list-reviews,
moderate-review), a `CompletedBookings` port implemented over the payments
`bookings` table, Drizzle repositories and controllers wired in
`bootstrap/container.ts`.

## 6. Cross-cutting

- Rate limits use the existing `guards.throttle` (per-replica; fine for one
  replica, as noted in `docs/api-architecture.md`).
- Review text is stored and rendered as plain text, never as HTML; links
  aren't made clickable.
- Audit events for write, delete and moderation, in the same transaction.
- Tests: eligibility (each booking status, other user's booking, window),
  one-per-listing upsert, summary deltas including hide/unhide, cursor paging
  with ties, limit validation, plain-text rendering.

## 7. Migration plan

| Phase | What                                                                                                                                                   | Depends on                     | Rollback                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------- |
| 0     | Decide R1 and add the completion rule to the payments work (bookings move to `COMPLETED`).                                                             | Payments phases 1–5            | —                                  |
| 1     | Migration, `reviews` module, write/delete endpoints, `review` state on My bookings, review form (sheet dialog).                                        | Phase 0                        | Drop the routes; table is additive |
| 2     | Public read: list endpoint, stars + count on experience page, overlay and Explore cards, "See all reviews" with paging, the viewer's own review shown. | Phase 1 (needs data to render) | Hide the UI; summaries stay        |
| 3     | Staff moderation list and hide/unhide in the admin panel.                                                                                              | Phase 1                        | Remove the admin tab               |

Phase 1 can be built in parallel with payments behind the `CompletedBookings`
port and tested with a fake, but it can't ship until real bookings exist.

## 8. Decisions needed

| #   | Question                                                         | Recommendation                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | What makes a booking `COMPLETED`?                                | Automatic: the reconcile job (payments D7) moves `CONFIRMED` bookings to `COMPLETED` 2 hours after their end time. Partners or staff can mark `NO_SHOW` within 72 hours, which also blocks a review. |
| R2  | One review per booking, or per traveller per listing?            | Per traveller per listing; a repeat visit lets them update it.                                                                                                                                       |
| R3  | Publish immediately or wait for staff approval?                  | Publish immediately, staff can hide with a reason. Pre-approval delays every review for a demo-scale team.                                                                                           |
| R4  | How long after the activity can someone review?                  | 90 days.                                                                                                                                                                                             |
| R5  | Show an average with very few reviews?                           | Show stars only from 3 reviews; below that show "New" and list the reviews.                                                                                                                          |
| R6  | Name shown on a review?                                          | First name + last initial from the account name ("Ada O."), plus month of the activity. No photos.                                                                                                   |
| R7  | Can partners reply publicly?                                     | Not in the first version; see §9.                                                                                                                                                                    |
| R8  | Prompt travellers to review (email/WhatsApp after the activity)? | Later, with the receipts provider (payments D8). First version: a "Leave a review" button on My bookings.                                                                                            |

## 9. Out of scope / deferred

- Partner replies and partner-facing review stats (partner portal, §9 of the
  payments plan).
- Reporting a review ("flag as inappropriate"), photo uploads, helpful votes.
- Reviews for packages.
- Review reminders by email or WhatsApp.

## 10. Implementation report (2026-11-22)

**Phase 0 — done.** The completion rule is decision D13 in
`docs/PAYMENT_INTEGRATION_PLAN.md`; the payments reconcile job must implement it.

**Phase 1 — domain and use cases done; storage, routes and UI waiting on
bookings.** No `bookings` table exists yet, so nothing can be stored, routed or
shown without inventing purchases.

Built in `src/modules/reviews/`:

- `domain/review.ts`: input rules (1–5 stars, title ≤ 80, body 20–2000),
  eligibility (`COMPLETED`, same listing, within 90 days, most recent wins),
  `reviewState` for My bookings, "Ada O." names, summary deltas, stars from 3
  reviews, opaque keyset cursors.
- `application/ports/`: `ReviewerBookings` (to be implemented over the payments
  `bookings` table) and `ReviewRepository` (to be implemented in Drizzle; every
  write adjusts `review_summaries` and writes an audit event in one
  transaction).
- `application/use-cases/`: `WriteReview`, `DeleteReview`, `ListReviews`,
  `GetRatingSummary`, `ModerateReview`, `ListReviewsForStaff`.
- `tests/reviews.test.ts`: 14 tests against an in-memory repository that follows
  the port contract.

**Remaining, in order, once payments phase 5 lands:** migration `0011_reviews.sql`
(§5), Drizzle `ReviewRepository` and `ReviewerBookings`, controllers and routes
(§4), container wiring, the review form on My bookings, then phases 2 and 3.
