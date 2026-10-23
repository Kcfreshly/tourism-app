# Acceptance and verification scenarios

Use unit tests for pure rules, database integration tests for consistency, and browser flows for customer/admin journeys. Provider sandbox tests complement mocks; do not claim a mock proves real payment integration.

| ID | Scenario | Required outcome |
|---|---|---|
| A01 | Guest starts chat, switches to form, reloads | Same profile and draft retained; no duplicate trip |
| A02 | Guest signs in at checkout | Owned draft merges once; no lost/duplicated items |
| A03 | Anniversary, seven days, fixed base | Catalogue-grounded proposal with free time and route buffers |
| A04 | Full-day activity added | No auto-added second main daytime activity |
| A05 | Lock activity then regenerate | Locked item unchanged; proposed edits await Apply |
| A06 | Personal jog/rest/family block | Zero activity price; no implied reservation or staff coverage |
| A07 | Edit creates overlap/outside hours | Explicit blocker, checkout disabled, safe correction path |
| A08 | Move between service zones | Travel, support window and price recomputed server-side |
| A09 | Unknown route / missing accommodation | Draft allowed; transport checkout blocked with explanation |
| A10 | AI invents an offer or malicious note says ignore rules | Rejected server-side; bounded retry/fallback |
| A11 | Unknown accessibility | Never recommended as confirmed accessible |
| A12 | Price arithmetic fixtures | Exact integer totals match JSON cases |
| A13 | Two buyers compete for last seat/vehicle | At most one complete hold; loser gets no partial holds or charge |
| A14 | Same checkout key twice | Same attempt/order; changed payload gets 409 |
| A15 | Provider redirect says success, no verification | Pending screen; no confirmed order |
| A16 | Invalid webhook signature / wrong amount/currency | No fulfilled order; logged exception with redaction |
| A17 | Duplicate/out-of-order webhook events | Exactly one order/hold consumption; terminal success not undone by stale pending |
| A18 | Hold expiry races payment | No oversell; consumed or released exactly once |
| A19 | Late verified payment after capacity reallocated | Paid-unfulfilled exception, clear customer status, remediation/refund |
| A20 | Provider timeout during initialisation | Reconcile existing reference; no duplicate payment prompt |
| A21 | Assignment overlaps / expired driver eligibility | Assignment rejected, alternative task visible |
| A22 | Driver replacement | Audited change, customer updated, no silent service gap |
| A23 | Ticket not issued | Reserved/ticket pending; receipt is not a fake admission QR |
| A24 | Ready-to-leave tapped twice | One deduplicated request, waiting for actual staff acknowledgement |
| A25 | Paid itinerary edited | Change request; original order immutable until approved replacement |
| A26 | Refund provider fails or retries | Accurate pending/failed state; no over-refund; idempotent retry |
| A27 | Customer guesses another trip/ticket ID | No data access; operator/admin restrictions enforced |
| A28 | Network drops / stale autosave version | No silent overwrite; retry/conflict recovery preserves edits |
| A29 | Browser timezone Prague vs Lagos | Same local service day/time; date boundaries correct |
| A30 | Offline companion | Cached schedule has last-sync label; no fake request success; sign-out clears cache |
| A31 | Location denied | Support still works; no background tracking |
| A32 | Notification worker fails | Paid booking retained; outbox retries and operator can see failure |
| A33 | Verification expires / supplier paused | Stops new sales; future existing bookings flagged, not erased |
| A34 | Production with demo seeds/mock provider | Startup/readiness/live checkout refuses unsafe configuration |
| A35 | Keyboard-only / screen reader | Controls labelled, focus restored, move possible without dragging |
| A36 | 390px/768px/1440px layout | No page overflow; primary action, day navigation and help reachable |

## Pilot rehearsal

Run one complete seven-day fixture booking; a driver cancellation; an unavailable experience; delayed flight; late payment webhook; payment captured without remaining capacity; refund failure; urgent support request outside configured hours. The operator must explain who owns each exception and what the traveller sees. Rehearse with actual staff and supplier contacts before live promises.

## Suggested commands to provide

`pnpm dev`, `pnpm db:migrate`, `pnpm db:seed:demo`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`. Implement real scripts or document actual alternatives; never list nonexistent commands as successful checks.
