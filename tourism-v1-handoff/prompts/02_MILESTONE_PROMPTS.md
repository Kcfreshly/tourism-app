# Focused milestone prompts

Use these in sequence if one coding-agent session cannot complete the project. Each prompt assumes the agent has the full handoff and current repository. Preserve completed work; no restarts or wholesale rewrites without evidence.

## A. Foundation and catalogue

Read the package and inspect the repository. Set up database migrations, repeatable explicitly demo seeds, secure identity boundaries, design tokens and app shells. Build Home, Explore, Experience Detail, unified form/chat profile shell and persisted guest trip drafts with login merge. Add catalogue admin draft/verify/publish gates. Use placeholders rather than unlicensed images. Do not implement payment yet. Verify saved drafts reload and private data access is denied. Deliver working commands and first screenshots.

## B. Planner and pricing

Implement multi-day itinerary, activity library, add/remove/move/edit, custom zero-price blocks, duration limits, lock, undo and autosave with version conflicts. Mobile uses day chips and add/move sheet; desktop uses library/timeline/price rail. Implement deterministic price rules, zone matrix and service selection. Build AI proposal adapter and deterministic fallback; validate all output and show diff before applying. Use `qa/pricing-cases.json`. Never let the model determine money or availability. Verify overlap, unknown-route, full-day and locked-item cases.

## C. Inventory and checkout

Implement PostgreSQL-backed atomic full-bundle holds and persisted checkout idempotency. Implement mock-for-demo and actual provider sandbox adapters with signed webhooks, raw-body validation, reference/amount/currency checks, webhook inbox, outbox and reconciliation. Confirm only from server-verified payment. Expired hold + late success must not oversell. Use separate DB connections for race tests. Deliver review/pay/verify/confirmation screens and exact sandbox setup. Keep live checkout disabled.

## D. Operations and pocket companion

Implement staff overview/action queues, trip fulfilment, resource/person assignment overlap checks, supplier ticket status and support. Build responsive Today/Plan/Bookings/Help; show real pending assignments and service windows. Ready-to-leave is a request with acknowledgement. Notification outbox has retry visibility. No fake phone numbers, QR tickets or real-time tracking. Verify assignment changes reach the customer and unauthorised access is denied.

## E. Changes, QA and pilot preparation

Implement approved change/cancellation requests, immutable booked terms and explicit refund states. Run complete acceptance cases, payment races, mobile/keyboard checks and offline/stale-state behavior. Add deployment/migration/backup/rollback and operator incident runbooks. Check live-mode refusal for demo data/keys/policies. Report remaining gaps honestly. Do not deploy or charge real customers merely to demonstrate completion.
