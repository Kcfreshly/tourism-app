# Payment integration plan (Paystack)

November 2026. Phase 1 steps 2–5 of the build order (section 8) are built as
of 2026-11-24, with the recommended decisions. Not built yet: the reconciler
(step 6), staff and partner bookings queues and refunds (step 7), emails
(step 8), and the `refunds` table. Differences from this proposal: the
migration is `0010_cart_checkout.sql`, which also holds the server cart;
`checkout_lines` stores `partner_id`; the commission is a sample 15%
(`defaultCommissionBps`) until partners have agreed rates; the return page
confirms the payment on the server; and a `simulated` provider stands in for
Paystack locally. See [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md).

Sources: the MIT FastLife database design (`Downloads/MIT-database`, portfolio
1 and 3), the checkout flow in `tourism-v1-handoff/docs/03_PRICING_AND_BOOKING.md`,
and the current code (`src/modules/bookings/domain/cart.ts`, migrations
`0001`–`0008`).

## 1. Scope

**Phase 1: cart checkout (this proposal).** The traveller pays once for a cart
of dated experience lines and package lines. Each line becomes its own booking
with its own status, terms and refund path. Staff confirm or decline partner
bookings and issue refunds from the admin panel. Paystack runs in **test mode**
only.

**Phase 2: trip checkout.** Cars, night cars and guides from the planner.
These need vehicle and guide pools with capacity per zone and day. This is
where the MIT `service_requests` / `service_assignments` tables come in.

**Partner portal (section 9).** Partners sign in, submit experiences and
planned trips (packages) for admin approval, confirm their own bookings and
see a dashboard of their activity. This doesn't have to ship before payments,
but payments are built for it: every slot, line and booking records its
partner from day one, so nothing has to be backfilled.

**Later.** Partner payouts through Paystack, and traveller self-serve cancellation.

Phase 1 only sells products whose capacity we hold. Anything without
an agreed capacity stays "not instantly bookable" (handoff rule).

## 2. Decisions needed before building

| #   | Question                                                                                   | Recommendation                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Can guests pay, or must they sign in?                                                      | Require sign-in. Paystack needs an email, and "My bookings" needs an owner. The guest cart merges on sign-in (`/api/v1/account/merge` already exists).                                                                                                                    |
| D2  | Package capacity: departures today store `OPEN/LIMITED/FULL`, not a number.                | Add `seats` (a number) per departure; derive the label from what remains.                                                                                                                                                                                                 |
| D3  | Capacity for flexible (drop-in) listings: per start time or per day?                       | Per day for flexible listings, per session for fixed ones.                                                                                                                                                                                                                |
| D4  | `confirmation: "PARTNER"` listings: charge up front, or authorise and capture later?       | Charge up front (Paystack has no card pre-authorisation for this). If declined or not confirmed by the deadline, refund in full including the fee.                                                                                                                        |
| D5  | Is the service fee refunded on cancellation?                                               | Refunded when we or the partner cancel; kept when the traveller cancels after the free-cancellation window. Needs a business sign-off.                                                                                                                                    |
| D6  | Children: the handoff says "not enabled", but our cart prices them.                        | Keep them, since partners set `childRateMinor`.                                                                                                                                                                                                                           |
| D7  | Where do the hold-expiry and reconciliation jobs run? Depends on hosting.                  | A protected `POST /api/internal/payments/reconcile` called by the host's cron every 5 minutes, plus lazy checks on read.                                                                                                                                                  |
| D8  | How do receipts and confirmations reach travellers?                                        | Email for phase 1; WhatsApp later. Needs a provider choice.                                                                                                                                                                                                               |
| D9  | How do partners get paid: Paystack split at payment time, or we collect and pay out later? | Collect and pay out. A single cart can hold several partners, and refunds after a split payment are hard to unwind. Keep a per-booking ledger (gross, commission, refunds, net due) and pay through Paystack Transfers once the service has happened.                     |
| D10 | Commission: one platform rate, or per partner?                                             | Per partner, stored on the partner, with a default. Copied onto each booking at payment so later changes don't rewrite history.                                                                                                                                           |
| D11 | Does an edit to a live listing go back for approval?                                       | Yes for price, capacity, schedule and story; the live version keeps selling until the change is approved. Pausing a listing applies immediately.                                                                                                                          |
| D12 | Should the dashboard show listing views?                                                   | Decided: yes. Views and visitors are counted in `listing_visits` (migration 0009).                                                                                                                                                                                        |
| D13 | When does a booking become `COMPLETED`? Reviews depend on it (docs/REVIEWS_PLAN.md R1).    | Decided: automatically. The reconcile job (D7) moves `CONFIRMED` bookings to `COMPLETED` 2 hours after their end time, with a `SYSTEM` row in `booking_status_history`. Partners or staff can mark `NO_SHOW` within 72 hours of the end time, which also blocks a review. |

## 3. Data model: migration `0010_checkout_payments.sql`

Money is `bigint` minor units (kobo), matching `rateMinor` and Paystack's
`amount`. The MIT `NUMERIC(12,2)` is not used. Statuses are `CHECK`ed, every
mutable table has `version` and `updated_at`, and ids match ours (`uuid`, owner
`text` → `auth_user.id`).

```sql
-- One row per sellable start: what gets locked. Created on first checkout,
-- capacity copied from the listing or departure at that moment.
inventory_slots (
  id uuid PK,
  product_type text CHECK IN ('EXPERIENCE','PACKAGE'),
  product_id text,            -- catalogue id or package slug
  partner_id uuid FK partners NULL,   -- null for listings Fastlife runs itself
  local_date date,
  start_time text,            -- 'HH:MM', or 'DAY' for flexible/packages
  capacity int CHECK (capacity > 0),
  capacity_unit text CHECK IN ('PERSON','GROUP','SEAT'),
  stop_sell boolean DEFAULT false,
  UNIQUE (product_type, product_id, local_date, start_time)
)

-- A priced, held cart. Becomes an order once payment is verified.
checkouts (
  id uuid PK, user_id text FK auth_user,
  status text CHECK IN ('HELD','PAYMENT_PENDING','PAID','EXPIRED','FAILED','REQUIRES_REVIEW'),
  subtotal_minor bigint, fee_minor bigint, total_minor bigint, currency char(3) DEFAULT 'NGN',
  price_version text, snapshot_hash text,
  expires_at timestamptz,               -- 15 minutes after creation
  idempotency_key text UNIQUE,          -- from the client, one per Pay press
  contact_email text, contact_phone text,
  version int, created_at, updated_at
)

checkout_lines (
  id uuid PK, checkout_id uuid FK, line_no int,
  product_type text, product_id text, slot_id uuid FK inventory_slots,
  local_date date, start_time text,
  units int CHECK (units > 0),          -- people, groups or seats taken from the slot
  party jsonb,                          -- adults, children, childAges, pickup + address, singleRooms
  price_rows jsonb,                     -- the PriceRow[] shown to the traveller
  subtotal_minor bigint, fee_minor bigint, total_minor bigint,
  terms jsonb,                          -- operator, venue, confirmation mode, partnerHours,
                                        -- freeCancellationHours, cutoff: the booked policy
  UNIQUE (checkout_id, line_no)
)

orders (
  id uuid PK, checkout_id uuid UNIQUE FK, user_id text,
  reference text UNIQUE,                -- traveller-facing, e.g. FL-7K3Q9P
  total_minor bigint, created_at
)

-- One per checkout line, created when payment succeeds.
bookings (
  id uuid PK, order_id uuid FK, checkout_line_id uuid UNIQUE FK,
  slot_id uuid FK, product_type, product_id, local_date, start_time, units,
  partner_id uuid FK partners NULL,
  commission_bps int,                   -- copied from the partner at payment (D10)
  status text CHECK IN ('AWAITING_PARTNER','CONFIRMED','DECLINED','CANCELLED','COMPLETED','NO_SHOW'),
  partner_deadline timestamptz,         -- null for INSTANT listings
  total_minor bigint, fee_minor bigint,
  version int, created_at, updated_at
)

booking_status_history (
  id uuid PK, booking_id uuid FK, from_status text, to_status text,
  actor_type text CHECK IN ('USER','STAFF','PARTNER','SYSTEM'), actor_id text,
  reason text, created_at
)

payments (
  id uuid PK, checkout_id uuid FK,
  provider text DEFAULT 'PAYSTACK', reference text UNIQUE,   -- we generate it
  access_code text, amount_minor bigint, currency char(3),
  status text CHECK IN ('INITIALISED','SUCCESS','FAILED','ABANDONED','REVERSED'),
  channel text, paid_at timestamptz, provider_payload jsonb,
  version int, created_at, updated_at
)

-- Every webhook, stored before it is acted on. Duplicates are ignored.
payment_events (
  id uuid PK, provider text, event text, reference text,
  payload_sha256 text UNIQUE, payload jsonb,
  received_at, processed_at, error text
)

refunds (
  id uuid PK, payment_id uuid FK, booking_id uuid FK NULL,
  amount_minor bigint CHECK (amount_minor > 0), reason text,
  status text CHECK IN ('REQUESTED','PROCESSING','PROCESSED','FAILED'),
  provider_refund_id text UNIQUE, requested_by text,
  created_at, processed_at
)
```

**Capacity rule.** Taken units for a slot are
`SUM(units)` over paid bookings that are not cancelled or declined, plus lines
of checkouts that are `HELD` or `PAYMENT_PENDING` with `expires_at > now()`.
A hold therefore lapses on its own when it expires, with no sweeper needed to
free capacity. Every check runs after `SELECT … FROM inventory_slots … FOR UPDATE`.
That is the MIT Portfolio 3 pattern, with slots locked in id order so two carts
can't deadlock.

**Refund ceiling.** The refund use case locks the `payments` row and refuses
any refund that would take the total refunded above `amount_minor`.

### Taken from the MIT design

`bookings`, `payments` (provider + unique reference), `refunds`,
`booking_status_history`, the `FOR UPDATE` re-check, partner confirmation with a
deadline (folded into `bookings`, because a phase 1 line has one operator), and
`actor_type`, which `audit_events` also gets.

### Changed or added

`checkouts`/`orders` (one payment for many lines), stored line snapshots
(people and children, pickup, per-line fee, booked terms), holds that expire,
`payment_events`, refund ceiling enforced, money in kobo, guests resolved
through D1, packages bookable.

### Not used

`users`, `experiences`, `cities`, `categories` and their join tables (our
catalogue stays JSONB), `itineraries`/`itinerary_items`/`itinerary_item_bookings`
(trips stay as one versioned document; phase 2 adds a nullable `trip_item_id`
on checkout lines), and the MongoDB and replication portfolios.

## 4. Flow

1. **Pay pressed** → `POST /api/v1/checkouts` with the cart lines, the total the
   traveller saw and an `Idempotency-Key` header.
   - Signed-in user, same origin, throttled.
   - Reprice every line on the server from the current listing, package and
     fee rules. If the total differs from what was shown, return `PRICE_CHANGED`
     with the new breakdown; nothing is held.
   - Check each line: listing published, runs on that date/time, booking
     cutoff, party min/max, minimum age, pickup address when pickup is chosen.
   - In one transaction: upsert slots, lock them in id order, check capacity,
     then insert `checkouts` (`HELD`, expires in 15 min) and the lines. If any
     line fails, roll back the whole cart and return `CAPACITY_UNAVAILABLE` naming the line.
2. **After commit**, call Paystack `POST /transaction/initialize` with
   the amount in kobo, our `reference`, email, `callback_url` and metadata
   `{checkoutId}`. Save the `payments` row (`INITIALISED`) and set the checkout to
   `PAYMENT_PENDING`. Return `authorization_url`. If Paystack times out, keep
   the hold and let reconciliation verify the reference before any new payment is created.
3. **Traveller pays** on Paystack's hosted page. Card data never touches our servers.
4. **Webhook** `POST /api/v1/payments/paystack/webhook`:
   - Read the raw body and check `x-paystack-signature` (HMAC-SHA512 with the
     secret key, timing-safe comparison). Reject if it doesn't match.
   - Insert into `payment_events`; a duplicate means it was already handled, so return 200.
   - For `charge.success`, call the same **confirm payment** use case as step 5, then return 200.
5. **Return page** `/checkout/return?reference=…` calls `GET /transaction/verify/:reference`
   through the **confirm payment** use case, then shows the order. If payment is
   still unknown it shows `PAYMENT_VERIFYING`, the "you don't need to pay again" message.
6. **Confirm payment** (idempotent, used by webhook, return page and reconciler):
   - Check that reference, amount, currency and checkout match. If not, set `REQUIRES_REVIEW`.
   - Lock the checkout. If it is already `PAID`, return the existing order.
   - If the hold is still valid: mark the payment `SUCCESS` and the checkout
     `PAID`, create the order, one booking per line (`CONFIRMED` for INSTANT,
     `AWAITING_PARTNER` with `partner_deadline` for PARTNER), status history
     and an audit event, then queue the emails.
   - If the hold expired: lock the slots and try to take the capacity again.
     If that fails, set `REQUIRES_REVIEW`, start a full refund and show
     `PAYMENT_REQUIRES_REVIEW`. Never oversell.
7. **Reconciler** (D7): verifies `PAYMENT_PENDING` checkouts past expiry and
   marks them `EXPIRED`/`FAILED` or confirms them. It also expires
   `AWAITING_PARTNER` bookings past their deadline, which triggers a refund per D4.
8. **Staff** (admin panel): a bookings queue, confirm/decline with a reason, and
   refunds per booking with the booked terms shown. A refund calls Paystack
   `POST /refund`, and the `refund.processed`/`refund.failed` webhooks update the row.
   The traveller sees "refund requested" until Paystack confirms it, never "refunded" before then.

## 5. Code layout

Following `src/modules/README.md`:

```
src/modules/bookings/
  domain/        cart.ts (exists), checkout.ts (line validation, capacity math,
                 status transitions), refund.ts (ceiling, fee rule)
  application/
    ports/       checkout-repository, payment-gateway, offer-catalogue,
                 package-catalogue, notifier, clock
    use-cases/   start-checkout, confirm-payment, record-payment-event,
                 reconcile-payments, list-my-orders, get-order,
                 respond-to-booking (staff), request-refund (staff)
  infrastructure/
    persistence/ schema.ts, drizzle-checkout-repository.ts
    paystack/    paystack-gateway.ts (initialize, verify, refund; fetch with timeout)
  presentation/http/controllers/
src/app/api/v1/checkouts/route.ts, checkouts/[id]/route.ts
src/app/api/v1/payments/paystack/webhook/route.ts
src/app/api/v1/orders/route.ts, orders/[id]/route.ts
src/app/api/v1/admin/bookings/route.ts
src/app/api/internal/payments/reconcile/route.ts
src/app/checkout/return/page.tsx
```

The use cases depend only on the `payment-gateway` port, so tests use a fake
gateway and Paystack can be swapped later.

## 6. Configuration and safety

- `PAYSTACK_SECRET_KEY` (server only), `PAYMENTS_ENABLED=true`,
  `RECONCILE_TOKEN`. Refuse to start payments unless the key starts with
  `sk_test_` while `APP_MODE=demo`. `assertDemo` (src/config) currently refuses
  `LIVE_CHECKOUT_ENABLED`; keep that refusal for live keys.
- Never trust a client amount. The webhook is the only unauthenticated write,
  and the signature check is what protects it.
- The webhook and return page handle only our own references; unknown
  references are logged in `payment_events` and otherwise ignored.
- Bookings and refunds write audit events in the same transaction (existing pattern).
- Replace the disabled Pay buttons (`cart.tsx`, `checkout-review.tsx`) only
  behind `PAYMENTS_ENABLED`.

## 7. Tests

- Concurrency with two real database connections: two carts racing for the
  last seat give exactly one hold (the handoff requires this).
- A hold expires on time; a late `charge.success` after another cart took the seat gives `REQUIRES_REVIEW` plus a refund.
- Duplicate webhook, webhook before return page, return page before webhook: one order every time.
- Bad signature, wrong amount, wrong currency, unknown reference.
- Price changed between cart and Pay.
- Refund ceiling; partial refund of one line keeps the others.
- Partner decline and missed deadline give a full refund.

## 8. Build order

1. Decisions D1–D8.
2. Migration `0010` + Drizzle schema + repository, plus the capacity concurrency test.
3. Domain: line validation, repricing on the server, capacity, status transitions.
4. `start-checkout` + Paystack initialise (test keys) + Pay button behind the flag.
5. Webhook + verify + `confirm-payment` + return page + "My bookings".
6. Reconciler + expiry.
7. Admin bookings queue, confirm/decline, refunds.
8. Emails (D8).
9. Phase 2: trip checkout with car and guide pools.

The partner portal (section 9) shipped first as `0009_partners.sql`
([PARTNER_PORTAL.md](PARTNER_PORTAL.md)), so `0010` can reference `partners`
directly, and its dashboard already reserves a place for bookings and sales.

## 9. Partner portal

### Journey

1. **Apply.** A signed-in user applies as a partner (business name, contact,
   phone, what they run). This creates a `partners` row in `PENDING` with
   them as `OWNER`.
2. **Admin verifies the partner.** They approve (`VERIFIED`) or decline with a
   reason. This is the activity/partner listing framework's business check,
   separate from approving individual listings.
3. **Partner submits listings.** A verified partner creates an experience or a
   planned trip (package) as a draft, fills the same fields staff use today
   (story, price, party rules, schedule, sessions, inclusions, photos, terms),
   and submits it. The existing readiness checks (`listingReadiness`,
   `packageReadiness`) run before it can be submitted.
4. **Admin approves or declines.** Approval publishes it; declining returns it
   with a reason the partner sees beside the fields to fix. Admin-only fields
   stay with staff: the review checklist, the night-visit security review,
   demo flags, featured placement.
5. **Changes to a live listing** go in as a new submission while the approved
   version keeps selling (D11). Approval swaps it in. Bookings already made
   keep their snapshot terms. Lowering capacity below places already sold is refused.
6. **Partner runs bookings.** Their queue shows `AWAITING_PARTNER` bookings
   with the deadline, plus confirm and decline buttons. Declining triggers the
   refund (D4). They also see upcoming bookings with headcounts, child ages and
   pickup details, as a manifest per date.
7. **Dashboard** (below).

### Tables (partner migration)

```sql
partners (
  id uuid PK, business_name text, contact_email text, phone text,
  status text CHECK IN ('PENDING','VERIFIED','DECLINED','SUSPENDED'),
  decision_reason text, verified_at timestamptz, verified_by text,
  commission_bps int,                   -- D10; null = platform default
  payout jsonb,                         -- bank details / Paystack recipient code (D9)
  version int, created_at, updated_at
)

-- Who can act for a partner. Membership, not a new auth role, so one person
-- can be both a traveller and a partner, and a business can have staff.
partner_members (
  partner_id uuid FK, user_id text FK auth_user,
  role text CHECK IN ('OWNER','STAFF'),
  PRIMARY KEY (partner_id, user_id)
)

-- catalogue and packages each gain:  partner_id uuid FK partners NULL

-- One per submitted version of a listing or package.
listing_submissions (
  id uuid PK, product_type text CHECK IN ('EXPERIENCE','PACKAGE'),
  product_id text, partner_id uuid FK,
  base_version int,                     -- live version it was edited from
  proposed jsonb,                       -- the full record as submitted
  status text CHECK IN ('PENDING','APPROVED','DECLINED','WITHDRAWN'),
  reason text, submitted_by text, decided_by text,
  created_at, decided_at
)
-- At most one pending submission per listing:
-- UNIQUE (product_type, product_id) WHERE status = 'PENDING'

-- Money owed to partners, one row per booking event (D9).
partner_ledger (
  id uuid PK, partner_id uuid FK, booking_id uuid FK,
  entry text CHECK IN ('SALE','COMMISSION','REFUND','PAYOUT'),
  amount_minor bigint,                  -- signed: sales positive, the rest negative
  created_at
)
```

Statuses on the listing itself become: `DRAFT` → `PENDING_REVIEW` →
`PUBLISHED` / `DECLINED`, plus `PAUSED`. The current demo statuses
(`RESEARCHED`, `DEMO_VERIFIED`, `DEMO_PUBLISHED`) map onto these when the
partner migration runs. Every submission, decision and partner verification
writes an audit event, with `actor_type` `PARTNER` or `STAFF`.

### Access rules

- The `Actor` (src/modules/identity/domain/actor.ts) gains the partner ids the
  account belongs to. Every partner endpoint checks that the listing or booking
  belongs to one of them. A partner never sees another partner's data, and
  never sees traveller contact details beyond what the booking needs
  (name, party, pickup).
- Only `VERIFIED` partners can submit, and only listings from verified (or
  staff-run) partners can be sold. Suspending a partner pauses their listings
  for new checkouts; existing bookings stay.

### Dashboard metrics (first version, all from bookings, D12)

| Metric                                              | Source                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| Bookings this month and last, by status             | `bookings` by `partner_id`, `created_at`            |
| Upcoming: next 7 / 30 days, with headcount          | `bookings` by `partner_id`, `local_date`            |
| Gross sales, commission, refunds, net due           | `partner_ledger`                                    |
| Awaiting your confirmation, and overdue             | `bookings` `AWAITING_PARTNER` vs `partner_deadline` |
| Confirmation rate and average response time         | `booking_status_history`                            |
| Top listings by bookings and sales                  | `bookings` grouped by `product_id`                  |
| Listings by status (live, pending review, declined) | catalogue, packages, `listing_submissions`          |

These are queries at our scale, with indexes on `bookings (partner_id,
local_date)` and `(partner_id, created_at)`; no separate metrics store.
Each partner metric endpoint is paginated or bounded by date range.

### Code layout

A new `partners` module (`src/modules/partners`) owns partners, members,
submissions, the ledger and dashboard queries. Catalogue keeps owning
listings, and applies an approved submission through its own use case.
Bookings keeps owning bookings; partner confirm/decline calls the bookings
use case through a port. Pages live under `src/app/partner/**`, with the
approval queue added to the existing admin panel.
