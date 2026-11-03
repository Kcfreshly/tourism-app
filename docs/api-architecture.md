# Ọ̀nà API architecture — account bucket

Status: Approved (phases 1–2) — 2026-11-03. Decisions: 8.1 merge, 8.2 keep in browser, 8.3 drop quietly.
Date: 2026-11-03
Scope: the traveller's bucket (shortlist of saved offers). Web client in `src/`, API routes under `src/app/api/v1`, Drizzle schema and SQL migrations.

## 1. Current state

| Item                   | Today                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Where the bucket lives | Browser only: `localStorage["tourism.bucket.v1"]`, read through `useBucket()` (`src/hooks/use-bucket.ts`)                 |
| Size                   | At most 30 offer ids, each ≤ 100 characters (enforced in the hook and in `profileSchema.selectedOfferIds`), so under 4 KB |
| Server copy            | None. Only a snapshot is copied into a trip's `profile.selectedOfferIds` when a draft is saved                            |
| Sign-out               | Clears the browser copy (`forgetTravellerState`), so a returning user starts with an empty bucket                         |
| Consumers              | Explore cards and tray, header pill, onboarding (Kemi and form), planner library, checkout prompt, experience overlay     |

Relevant conventions already in the codebase: JSON envelope `{ data, meta }` / `{ error: { code, message }, meta }` with `Cache-Control: private, no-store` (`src/server/identity.ts`); same-origin check on every write (`checkOrigin`); Postgres-backed fixed-window limiter (`limit(key, max, seconds)`); additive SQL migrations in `migrations/`.

## 2. Problems

1. **A signed-in user's bucket isn't remembered.** It's lost on sign-out (by design since the shared-device fix) and doesn't follow the user to another browser or device.
2. **There is no owner on the cached copy.** If two accounts used one browser without signing out cleanly, the cache can't tell whose list it is.

## 3. Design principles here

- The **database is the source of truth** for signed-in users. The browser copy is a **cache** for instant render: the page paints from the cache, then reconciles with the server in the background.
- The payload is tiny and bounded (≤ 30 ids), so the whole list is read and written at once. Pagination, batching and partial updates would add complexity for no gain.
- Writes are **optimistic and debounced**: a tap updates the cache and UI immediately, and one save follows when the traveller pauses.
- Guests keep their bucket in the browser only; nothing is stored server-side until they sign in.

## 4. Target endpoint catalog

All require a signed-in account. Guests get `401 SIGN_IN_REQUIRED`.

### `GET /api/v1/bucket`

- Purpose: load the account's bucket after sign-in and on each app load.
- Response: `{ "data": { "offerIds": ["offer-gallery", "offer-suya"], "version": 7 } }`. No bucket row yet returns `{ offerIds: [], version: 0 }`.
- Size bound: ≤ 30 ids, under 4 KB.
- Cost: cheap primary-key lookup. Rate limit: shares the general read budget (no separate limit needed).
- Cache: `private, no-store` (existing envelope). The client cache provides the speed.

### `PUT /api/v1/bucket`

- Purpose: replace the account's bucket after the traveller saves or removes items, and to merge a guest bucket at sign-in.
- Body: `{ "offerIds": string[] (≤ 30, unique, each ≤ 100 chars), "expectedVersion": number }`.
- Server behaviour: drops ids that aren't currently published offers, keeps order, stores the list, increments `version`.
- Response: `{ "data": { "offerIds": [...], "version": 8 } }` with the cleaned list.
- Errors:
  - `409 VERSION_CONFLICT` when another tab or device saved first. The body uses the standard error envelope; the client re-reads the version with `GET` (see §10).
  - `422 INVALID_BUCKET` for a malformed body or more than 30 ids.
  - `403 ORIGIN_REJECTED`.
  - `429 RATE_LIMITED`.
- Rate limit: `bucket-write:<userId>`, 60 per minute. Basis: the client debounces to at most about one save per second of activity. 60 is the same starting default the catalogue editor uses, and it will be revisited with real usage.

No new endpoint for the sign-in merge: the client reads with GET and, if the guest had items, writes the union with PUT.

## 5. Data layer

New table (migration `0005_account_bucket.sql`, additive):

```sql
CREATE TABLE IF NOT EXISTS account_buckets (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  offer_ids jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- One row per account, so the table has at most one row per user and reads are a primary-key lookup.
- `ON DELETE CASCADE` removes the bucket with the account.
- Writes use `INSERT … ON CONFLICT (user_id) DO UPDATE … WHERE version = expectedVersion`. No returned row means a version conflict.

## 6. Client cache and sync

- **Cache keys:** `tourism.bucket.v1` (the ids, unchanged) plus a new `tourism.bucket.owner` (the user id the cache belongs to; empty for a guest).
- **`useBucketSync()`** (new, `src/hooks/use-bucket-sync.ts`) is mounted once in the site header and watches the auth session:
  - **Signed in, cache owned by this user:** render the cache immediately, then GET in the background and replace the cache if the server differs.
  - **Signed in, cache belongs to a guest (just signed in):** GET, merge as decided in §8.1, PUT if the result changed, then mark the cache as owned.
  - **Signed in, cache belongs to someone else:** discard the cache and use the server copy.
  - **Signed out:** nothing to sync. Sign-out already clears the cache.
- **Writes:** `useBucket().toggle/clear/restore` update the cache instantly (no change to render speed). When signed in, the sync hook saves the latest list about 600 ms after the last change.
  - On `409`, it adopts the server version number and re-sends the traveller's current list, because the device the person is actively using wins.
  - On network failure it retries on the next change or page load, and the cache keeps the traveller's intent.
- **Bucket full:** the cap of 30 is enforced in the cache and on the server.

## 7. Migration plan

1. **Phase 1 (additive):** migration 0005, the schema entry, and the GET/PUT routes with Zod validation, origin check, rate limit and version check. Unit and API tests. Nothing calls them yet, so this is safe to deploy alone.
2. **Phase 2:** `useBucketSync()`, owner key on the cache, mounted in `SiteChrome`. The bucket now loads after sign-in and follows the account. Browser check: save, sign out, sign in on a fresh browser, bucket returns. Rollback: unmount the hook; the app falls back to today's browser-only bucket.
3. No removals: the browser cache stays as the render source.

## 8. Decisions needed

1. **Guest bucket at sign-in:** _(recommended)_ merge, so the guest's picks are added after the account's saved ones (up to 30). Or: the account's saved bucket replaces the guest picks.
2. **Guest bucket before sign-in:** _(recommended)_ keep it in this browser (localStorage) until sign-in or clear, as today. Or: forget it when the browser session ends (sessionStorage).
3. **Unknown or paused offers on save:** _(recommended)_ drop them quietly and return the cleaned list. Or: reject the save with `422`.

## 9. Out of scope

- Live push between open devices (the next page load or focus refresh picks changes up).
- Sharing a bucket between travellers.
- Changing how trips snapshot `selectedOfferIds`.

## 10. Implementation report (2026-11-03)

Both phases are built.

| Piece | Where |
| --- | --- |
| Migration | `migrations/0005_account_bucket.sql` |
| Schema | `accountBuckets` in `src/server/schema.ts` |
| Server logic | `src/server/bucket.ts` (load, versioned save, drops unpublished offers) |
| Validation and merge rule | `src/domain/bucket.ts` |
| Route | `src/app/api/v1/bucket/route.ts` (`GET`, `PUT`) |
| Browser sync | `src/hooks/use-bucket-sync.ts`, mounted in `src/components/site-chrome.tsx` |
| Cache helpers and keys | `src/hooks/use-bucket.ts`, `src/hooks/browser-store.ts` |
| Sign-out flush | `src/hooks/use-sign-out.ts` |

**Measured:**
- A signed-in full page load makes 1 `GET /api/v1/bucket` with a 96-byte response for an empty bucket. In-app navigations make 0 requests, because the header stays mounted.
- Each pause after edits makes 1 `PUT`. Two quick taps produce one save.

**Deviations from §4–§6:**
1. **The `409` body is the standard error envelope** with no current list. The client re-reads the version with `GET` and re-sends its list once. This keeps the shared error format unchanged.
2. **Early taps are replayed, not kept wholesale.**
   - Taps made before the first `GET` returns are recorded as adds and removes, then applied to the server's list. A stale cache can't overwrite changes made on another device.
   - The browser check found the race this prevents: a tap made while the page was loading was overwritten by the server copy.
   - The pending flag still covers changes left unsaved from an earlier visit (offline, closed tab); those keep the cached list.
3. **Sign-out sends any pending save** before ending the session, so the last tap isn't lost.

**Verification:**
- Unit tests: `tests/bucket-sync.test.tsx` and `tests/sign-out.test.tsx`.
- Browser and API check: `scripts/check-bucket.mjs` covers guest 401, cross-origin 403, guest picks saved at sign-up, 409, 422, unknown ids dropped, restore on a fresh browser, and saving a removal.

**Not verified:**
- Two devices editing at exactly the same moment. The design accepts last-writer-wins for the device in use.
- PostgreSQL, as opposed to the local PGlite database.
- The rate limit under real traffic.

