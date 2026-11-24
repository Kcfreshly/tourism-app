# Cart, end to end

November 2026. What a "proper" cart needs, from the first Add to cart to a
completed booking. Payment details (tables, Paystack flow, refunds) are in
[PAYMENT_INTEGRATION_PLAN.md](PAYMENT_INTEGRATION_PLAN.md); this doc covers the
cart around them and points there instead of repeating them.

## 1. The journey

```
browse → add line (date, guests, pickup) → cart (persisted, shown on every device)
  → sign in (guest cart merges) → review → Pay
  → server reprices + validates + holds capacity → Paystack
  → webhook / return page → order + one booking per line → cart lines cleared
  → confirmation email → partner/staff confirm or decline → (refund)
  → COMPLETED → review
```

The journey is end to end only when every arrow works and has a tested
failure path.

## 2. What exists today

| Piece                                      | Where                                                  | State                                                                       |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Line schema (experience, package), limit 20 | `src/modules/bookings/domain/cart.ts`                  | Done. Zod, discriminated union                                              |
| Line pricing + per-line fee                | same file                                              | Done, but reads `tourism-v1-handoff/data/pricing.demo.json`                 |
| Add / edit from listing and package pages  | `booking-panel.tsx`, `package-booking.tsx`             | Done                                                                        |
| Cart storage                               | `src/hooks/use-cart.ts`                                | **localStorage only** (`tourism.cart.v1`)                                   |
| Line resolution + "problem" checks         | `view()` in `src/components/cart.tsx`                  | **Client only.** Date passed, not running that day, child ages, trip gone, departure FULL |
| Cart page, nav pill, save for later        | `src/components/cart.tsx`                              | Done                                                                        |
| Checkout review, sign-in gate              | `src/app/checkout/page.tsx`, `checkout-review.tsx`     | Done. Pay button disabled; name/email/phone not submitted anywhere          |
| Guest → account merge                      | `merge-guest-drafts.ts`                                | **Moves trip drafts only, not the cart**                                    |
| Sign-out                                   | `forgetTravellerState()` in `browser-store.ts`         | Wipes the cart, which then exists nowhere                                   |
| Checkout / orders / bookings / payments    | none                                                   | Not built (migration `0010` is still a proposal)                            |

Correction to the payment plan, D1: it says "the guest cart merges on sign-in
(`/api/v1/account/merge` already exists)". That endpoint does not touch the
cart, so the merge has to be built.

## 3. What has to be built

### A. Server cart (persistence and devices)

1. Migration `0010_carts.sql` (renumber the payment migration to `0011`):
   `account_carts (user_id PK → auth_user, lines jsonb, version int, updated_at)`,
   the same shape as `account_buckets`. One document per account is enough at
   20 lines; nothing reads one line on its own.
2. `GET/PUT /api/v1/cart` with optimistic `version` (409 on conflict), body
   validated with `cartLineSchema`, capped at `cartLimit`. Same controller and
   repository pattern as `/api/v1/bucket`.
3. `useCart` follows `useBucket`: localStorage stays the cache, with
   `cartOwner` and `cartPending` keys so a signed-in change survives a failed
   request and the cache is never shown to the wrong account.
4. Merge on sign-in: union of guest lines and account lines, dedupe on
   `(kind, offerId|packageSlug, date, time)` keeping the newer line, cap at 20,
   and say so if anything was dropped.
5. Sign-out keeps clearing the browser copy; the account copy returns at the
   next sign-in. A guest cart on a shared device is still lost on sign-out,
   which is intended.

### B. One source of truth for line checks and prices

The server has to reach exactly the result the cart page shows, or Pay will
fail with `PRICE_CHANGED` for no visible reason.

1. Move `view()`'s checks out of `cart.tsx` into
   `src/modules/bookings/domain/cart.ts` as `resolveLine(line, listing | package, today)`
   returning `{ rows, totalMinor, terms, confirmation, problem? }`. The
   component keeps only labels and links.
2. Add the checks the client skips today: booking cutoff, party min/max,
   minimum age, pickup address present when pickup is chosen, partner
   `VERIFIED` and listing `PUBLISHED`, session exists at that `time`.
3. Pricing rules (`feeBps`) come through a port on the server, not a JSON
   import, so the fee can change without a deploy. The client can keep
   importing them for the preview.
4. `POST /api/v1/cart/quote`: reprices the cart on the server and returns
   per-line problems. The checkout page calls it on load, so "price changed"
   and "no longer available" show before Pay, not after.

### C. Availability while in the cart

1. Package departures get numeric `seats` (payment plan D2); the label
   (`OPEN/LIMITED/FULL`) is derived from what remains.
2. The quote (B4) returns remaining capacity per line from `inventory_slots`,
   so a line can say "2 places left" or "Sold out for this date" before checkout.
   Nothing is held until Pay.

### D. Checkout and payment

As in the payment plan, sections 3–4: `POST /api/v1/checkouts` with an
`Idempotency-Key`, server repricing, slot locks and a 15-minute hold, Paystack
initialise, webhook with signature check, return page, `confirm-payment`
use case, reconciler. Cart-specific points:

1. Pay sends line ids and the total the traveller saw. Lines with a problem
   are excluded, as the review page already shows.
2. Lead-guest name and phone from the review page are sent and stored on the
   checkout (`contact_email`, `contact_phone`), validated server side.
3. The Pay button needs `agreed`, a phone number, and `PAYMENTS_ENABLED`.
4. Error states on the review page: `PRICE_CHANGED` (show old → new, re-tick),
   `CAPACITY_UNAVAILABLE` (name the line, offer another date or remove),
   `PAYMENT_VERIFYING`, `PAYMENT_REQUIRES_REVIEW`.
5. Double-press, back button from Paystack, and a second tab must never
   create a second payment for the same cart.

### E. After payment

1. Clear only the lines that became bookings, after `confirm-payment`
   succeeds, on the server cart. Lines that were skipped stay in the cart.
2. `/checkout/return` → order page with reference `FL-XXXXXX`, one card per
   booking showing its status.
3. "My bookings" under account: list and detail, from `orders`/`bookings`.
4. Emails: receipt on payment, then confirmed / declined + refunded per
   booking (payment plan D8, needs a provider).

### F. Operations

1. Partner queue: confirm / decline `AWAITING_PARTNER` before the deadline
   (partner portal already reserves the place).
2. Admin bookings queue, refunds with the ceiling.
3. Reconciler: expires holds and payments, auto-declines missed partner
   deadlines (refund per D4), moves bookings to `COMPLETED` (D13), which opens
   reviews.

### G. Tests and checks

- Unit: `resolveLine` against every problem case; client view and server
  quote give the same totals for the same input.
- API: cart `PUT` version conflict, merge dedupe and cap, quote with a
  changed price.
- Concurrency and payment cases from payment plan section 7.
- Browser: add → cart → sign in (merge) → review → Paystack test card →
  return → My bookings, at phone width and desktop, per
  `skills/ui-formatting/SKILL.md`, including the last cart line above the
  sticky summary on mobile.

## 4. Decisions to make first

| #   | Question                                                | Recommendation                                                                 |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| C1  | Server cart storage: one jsonb document or line rows?   | One document per account (`account_carts`), like the bucket.                    |
| C2  | Merge rule when guest and account carts both have lines | Union, dedupe on product + date + time keeping the newer line, cap 20.          |
| C3  | Do cart lines expire?                                   | No; past-dated lines show as problems, as today. Purge lines 30 days past date. |
| C4  | Can the traveller pay for some lines and leave others?  | Yes, implicitly: problem lines are skipped. No per-line checkbox in phase 1.    |
| C5  | Show remaining capacity in the cart?                    | Only when low ("2 places left") or none.                                        |

Plus the open payment decisions D1–D8, D9–D11 in the payment plan. D1 (sign-in
to pay), D2 (numeric seats) and D8 (email provider) block this work.

## 5. Build order

Each step ships on its own and leaves the app working.

1. **Server cart**: migration, `GET/PUT /api/v1/cart`, `useCart` sync,
   merge on sign-in. Guests notice nothing; signed-in carts follow them.
2. **Shared line resolution**: move checks into the domain, add the
   missing ones, `POST /api/v1/cart/quote`, review page uses it.
3. **Numeric seats and slots**: D2, `inventory_slots`, remaining capacity in
   the quote.
4. **Checkout + Paystack test mode**: payment plan build-order steps 2–5,
   Pay button behind `PAYMENTS_ENABLED`.
5. **After payment**: clear paid lines, order page, My bookings.
6. **Reconciler, partner/admin queues, refunds.**
7. **Emails.**
8. Full browser run of the journey in section 1.
