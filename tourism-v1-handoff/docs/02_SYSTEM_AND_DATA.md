# System design and implementation contract

## Architecture recommendation

Use a modular monolith for the one-month build. Proposed greenfield stack: TypeScript, Next.js/React responsive frontend, Express API, PostgreSQL and Drizzle; pnpm workspace. Treat this as a recommendation, not a requirement to replace a compatible existing repository. Use one server and one database, not independent microservices. An all-in-one Next.js implementation is acceptable if modules, server authority and workers remain clear. Check supported versions and current provider APIs in official documentation at implementation time; this brief does not pin versions.

Suggested layout:

```text
apps/web/                    # public, planning, companion, admin routes
apps/api/src/modules/
  identity/ catalogue/ trips/ pricing/ inventory/
  checkout/ payments/ fulfilment/ support/ ai/
packages/contracts/          # runtime schemas, enums, API DTOs
packages/ui/                 # tokens and accessible shared components
packages/test-fixtures/
docs/                        # implementation decisions, setup and runbook
```

Server modules expose typed services; frontend never writes database records directly. Deterministic pricing/inventory is independent of model output. API validation uses runtime schemas at every trust boundary. API identifiers are UUIDs; fixture human-readable IDs are seed keys mapped on import. Migration history, repeatable seeds and transactional database tests are required.

Adapters: PaymentGateway, PlannerModel, NotificationSender, TravelEstimator, TicketStore. Provide working deterministic local adapters and clearly marked production interfaces. The mocked payment adapter must be impossible to enable accidentally in production. No production success path may be a localStorage flag.

## Entity dictionary

Every mutable entity has createdAt, updatedAt and a version when concurrent edits are possible. Money is integer minor units plus ISO currency; never binary floating-point. Local service dates/time zone are stored explicitly alongside UTC instants. Launch time zone `Africa/Lagos`; browser timezone does not change the booked local schedule.

| Entity | Core fields and invariants |
|---|---|
| User | id, email, verified contact, role; roles CUSTOMER/OPERATOR/ADMIN; no public role assignment |
| City / Zone | id, cityId, name, timezone, serviceable, polygon or validated zone lookup |
| Trip | ownerId, cityId, startDate, endDate, party, profile, accommodation, status, version; single currency/city in V1 |
| TripPreference | interests, occasion optional, pace, party budget, mobility/dietary requests, consent; sensitive details minimised |
| Venue | name, address, coordinates if verified, area, hours, venue notes; not itself a booking |
| Supplier | legal/display name, contact, agreement status, booking method, settlement terms, evidence, expiry |
| Experience | category, venue/route, duration bounds, kind MAIN/LIGHT/FULL_DAY, eligibility, intensity, notes, verification state |
| Offer | experienceId, supplierId, price basis, age/party limits, inclusions, host included, policyVersion, enabled |
| AvailabilitySlot | offerId, startAt/endAt, localDate, capacity unit/count, cutoffAt, version |
| ResourcePool | city/zone, type VEHICLE/GUIDE/AIRPORT_WELCOME, capacity unit, service window and contractual backing |
| ResourceInterval | poolId, start/end including travel/reposition buffers, held/booked units |
| ItineraryItem | tripId, day, kind EXPERIENCE/CUSTOM/BREAK/TRAVEL, start/end, offerId nullable, lock, notes, source; custom items zero-priced |
| PriceVersion | effective dates, configurable rates, fee/tax settings, transport zone bands, policy version; immutable once used |
| PriceCalculation | tripVersion, priceVersion, lines, warnings, blockers, currency, expiresAt; derived not a promise of inventory |
| CheckoutAttempt | tripVersion, snapshotHash, idempotency key, holdId, payment reference, status, expiresAt |
| InventoryHold / HoldItem | checkoutAttemptId, resource/slot, quantity, interval, expiresAt, state; entire bundle acquired atomically |
| Order / OrderLine | ownerId, immutable itinerary and line snapshots, currency, total, payment and reservation status; preserves booked terms |
| Reservation | orderLineId, slot/pool, units, supplierRef nullable, status; supplier ticket state separate |
| Payment / PaymentEvent | provider, unique providerRef, amount, currency, status, verifiedAt, eventId unique; no card details stored |
| Refund | paymentId, amount, reason, providerRef, status, idempotency key; sum never exceeds captured less refunded |
| Person / Vehicle | role/eligibility, checks, photo rights, service zones, schedule, verified expiry; protected contact details |
| Assignment | reservationId, person/vehicle, interval, status, publishedAt; prevents overlaps/reposition conflicts |
| ChangeOrder | originalOrderId, proposed diff, price delta, customer approval, capacity hold, payment/refund; no silent paid-order rewrite |
| SupportRequest / Incident | tripId, category/severity, optional consented location, owner, status, event log |
| OutboxEvent | eventId, type, payload, retry count, next attempt, deliveredAt; durable notifications |
| AuditEvent | actor, action, entity, time, redacted before/after, correlationId; append-only |

## Distinct state machines

Trip: DRAFT → READY_FOR_CHECKOUT → BOOKED → ACTIVE → COMPLETED; CANCELLED is explicit. Failed checkout leaves editable draft. BOOKED means a paid/reserved order exists, not that every supplier ticket has arrived.

Payment: CREATED → PENDING → SUCCEEDED / FAILED / EXPIRED; verified late success becomes SUCCEEDED with an order-resolution exception if capacity is no longer held. Refund status is recorded separately (NONE/PENDING/PARTIAL/FULL/FAILED), not by overwriting payment history.

Hold: ACTIVE → CONSUMED / EXPIRED / RELEASED. Transitions are compare-and-set and idempotent. One successful payment can consume only one hold/order.

Reservation: HELD → RESERVED → CONFIRMED → DELIVERED; CANCEL_PENDING/CANCELLED or EXCEPTION. RESERVED means allocated against agreed capacity; CONFIRMED includes required supplier acknowledgement/ticket. Sell only contractually backed capacity at checkout; do not disguise speculative requests as reserved bookings.

Assignment: UNASSIGNED → ASSIGNED → ACKNOWLEDGED → EN_ROUTE → ARRIVED → COMPLETED; CANCELLED/REPLACEMENT_REQUIRED. These statuses do not determine whether payment succeeded.

Support: OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED; REOPENED when necessary. An urgent request still requires an actual staff response.

## API surface

All routes below are illustrative versioned endpoints under `/api/v1`. Return `{data, meta:{requestId}}` or `{error:{code,message,fieldErrors?,details?}, meta:{requestId}}`. Use 401 unauthenticated, 403 forbidden, 404 hidden or missing resource, 409 version/capacity conflict, 422 invalid input, 429 throttled and 503 provider unavailable. Never leak raw provider errors or stack traces.

| Method / path | Behavior |
|---|---|
| GET `/cities`, `/categories`, `/experiences` | public approved catalogue, filters, cursor pagination |
| GET `/experiences/:id`, `/offers/:id/availability` | approved detail, eligible slots; no private supplier contacts |
| POST `/trips` | create draft under guest session or user |
| GET/PATCH `/trips/:id` | ownership enforced; PATCH uses expectedVersion |
| PUT `/trips/:id/items` | atomic schedule edit; validates references/times and returns current price validation |
| POST `/trips/:id/plan` | generate proposal from profile; returns proposed items and validation; no silent application |
| POST `/trips/:id/plan/apply` | apply chosen proposal with expectedVersion and locked-item protection |
| POST `/trips/:id/price` | server recalculation; return priceVersion, priceId, expiry, lines, warnings and blockers |
| POST `/checkouts` | tripId/version, accepted priceId and idempotency key; atomic bundle hold; returns expiry and payment handoff |
| GET `/checkouts/:id` | stable verified state for polling; owner only |
| POST `/payments/webhooks/:provider` | signed raw-body validation, replay protection, durable event intake |
| GET `/orders/:id`, `/orders/:id/receipt` | owner or assigned authorised staff; ticket links signed/short-lived |
| POST `/orders/:id/change-requests` | proposed paid itinerary change; never edits base order |
| POST `/orders/:id/cancellation-requests` | policy preview/approval flow, release inventory only in valid transaction |
| GET `/trips/:id/today` | local-date itinerary and permitted contact details |
| POST `/trips/:id/support` | category/message/optional one-time location; return actual request state |
| POST `/assignments/:id/ready-to-leave` | traveller request deduplicated; staff acknowledgement required |
| GET `/admin/overview`, `/admin/trips` | role-restricted operational queues |
| PATCH `/admin/catalogue/:id`, `/admin/slots/:id` | versioned config with audit and publish gates |
| POST `/admin/assignments` | eligibility + interval validation + audit + outbox notification |
| POST `/admin/refunds` | authorised amount/reason, provider idempotency, audit |
| PATCH `/admin/support/:id` | owner/status transitions, notification event |

Example checkout request:

```json
{"tripId":"uuid","expectedTripVersion":7,"acceptedPriceId":"uuid","idempotencyKey":"client-generated-uuid"}
```

Same idempotency key + same canonical payload returns original result; same key + different payload returns IDEMPOTENCY_KEY_REUSED (409). Scope keys by actor and operation. Store canonical payload hashes and result references in database, not process memory.

## Security and privacy requirements

Use a maintained authentication solution with secure HttpOnly/SameSite cookies, CSRF protection appropriate to architecture and server-side session invalidation. Customer object access checks apply to every endpoint, ticket and support record. Operator scopes restrict access to assigned work; Admin manages pricing and refunds. Demo-role switching exists only in local/demo mode.

Validate uploads, limit size/types, remove photo metadata where appropriate and use signed object access. Keep provider/model secrets server-side. Rate-limit authentication, chat, support and checkout. Verify webhook signatures using the raw body and provider guidance. Reject unsigned live events. Do not log secrets, full payment payloads, location, dietary/health details or raw chat by default.

Ask permission before one-time location attachment; background tracking is not implemented. Proposed configurable retention defaults: chat 30 days, one-time location 24 hours after ticket closure, trip operational notes 90 days after completion. Financial records follow an explicitly reviewed retention policy; these defaults are product assumptions, not legal advice. Provide account-data export/deletion request workflow; explain records retained for fulfilment/accounting. Sign-out removes private browser caches.

## Reliability

Database transaction covers inventory acquisition and order materialisation; never hold a database transaction open during provider network calls. Use persisted checkout attempt, external idempotency, webhook inbox and reconciliation job to bridge that gap. Expire holds using database time; include conservative buffers in all resource intervals. Notifications use transactional outbox with bounded retries and dead-letter visibility. A failed email cannot undo a paid order.

Scheduled jobs: hold expiry; payment reconciliation; assignment deadline alerts; verification expiry; outbox retry. Jobs acquire locks or use idempotent work claims to survive multiple workers. Reconciliation looks for pending or late payments, compares amount/currency/reference and escalates mismatches. Provide health/readiness endpoints, structured logs, request IDs, error tracking and database backups with a tested restore procedure before live sales.

## Deployment and local setup deliverables expected from the agent

Working README with setup, migrations, seed, dev, typecheck, lint, tests, production build and rollback instructions; `.env.example` with descriptions and no secrets; Docker Compose for local PostgreSQL if appropriate; CI for checks; production migration procedure; cron/worker deployment configuration; provider setup instructions verified at implementation time. Do not publish externally or connect live payments unless the owner requests that next step.
