# Lagos, Your Way — V1 local foundation

Working brand, fictional supply, no real bookings. The local demo now includes catalogue, account/guest drafts, catalogue administration and the core multi-day planner with automatic prices. It is not the complete V1; checkout, fulfilment and companion remain pending.

## Backend architecture

See [the backend architecture guide](docs/BACKEND_ARCHITECTURE.md) for the implemented components, API routes, database model and request flows, with Mermaid diagrams. The main component map is also available as [a standalone Mermaid file](docs/backend-data-flow.mmd).

## Run locally

Node 24 was used. Install with `npm ci` (the committed npm lockfile is authoritative). pnpm can execute the scripts, but dependencies were resolved with npm on this Windows machine. PowerShell execution policy blocks npm.ps1 here; use `npm.cmd`.

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:seed:demo
npm.cmd run dev
```

Open http://127.0.0.1:3000. Browse Explore, start a plan, save the profile and choose **Open my itinerary**. My trips resumes saved plans. Form/chat share one profile. The deterministic intake helper recognises ISO date pairs, adult counts and category words, previews changes and asks up to two questions; it is not a live AI model.

In the planner, add/edit/move/remove experiences or private blocks, lock items, undo and preview a generated plan before applying. Drag cards to day chips or use Edit / move. Changes autosave with server version checks. Review services to choose 4/8-hour dedicated vehicle coverage and optional guides. Confirm a fictional accommodation label and zone in the profile to clear missing-base blockers. Totals are server-calculated NGN minor units, including line items and integer half-up fees. Invalid drafts remain editable with explicit blockers. No capacity is held and checkout is disabled pending milestone C.

`/account` supports demo email/password accounts (12+ character password), sign-in, sign-out and guest-draft linking. Account roles cannot be set at registration. Email delivery, ownership verification and password recovery are unconfigured. Use fictional details and a unique demo password. A random local auth secret is generated in ignored `.local/auth-secret` unless AUTH_SECRET is supplied.

To use `/admin`, first create a demo account, stop the dev server, run `npm.cmd run demo:grant-admin -- fictional-email@example.test`, then restart and sign in. This explicit local owner action is audited; no public role switch or default staff credential exists. Admin supports fictional drafts, review checklists, demo verification/publication, rates/capacity editing and pausing. Demo review never verifies a real supplier or enables live sales.

Local configuration defaults work without credentials. Copy `.env.example` to `.env.local` for Next.js overrides. CLI scripts read environment variables from the shell (not `.env.local`). `PUBLIC_APP_URL` must exactly match the browser origin for write requests. Do not interchange localhost and 127.0.0.1.

PGlite stores the demo in `.local/demo-db`; stop the server before migrations/seeds/backups because only one process may own this directory. Seeds validate the supplied JSON Schema, are repeatable and preserve existing records. `DATABASE_URL` selects PostgreSQL through postgres.js/Drizzle. No actual PostgreSQL server was available for validation; multi-process booking tests are pending. Never use PGlite results as evidence of production booking races.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
# With dev server running: creates two retained fictional test drafts
node scripts/check-api.mjs
node scripts/check-planner.mjs
node scripts/check-account.mjs
# Or run all three against the running server
npm.cmd run test:integration
# Admin test setup: stop server, grant the generated fictional QA account, restart
# npm.cmd run demo:grant-admin -- --qa-fixture
npm.cmd run test:admin
# Optimized local demo build only
$env:ALLOW_LOCAL_DEMO_BUILD='true'
npm.cmd run build
npm.cmd start
```

The local-demo build override permits production-optimized demo execution only. APP_MODE other than demo and LIVE_CHECKOUT_ENABLED=true remain refused. There is no payment endpoint. Never deploy this private-data prototype publicly. No external provider secrets are needed or used. Integration tests retain fictional trips/accounts; account credentials/cookies are kept only in ignored `.local/qa-account.json`, never printed. Admin tests retain their new listing as PAUSED.

## What exists and what remains

Implemented: Home; eight categories including Lagos Life; fictional catalogue/details and public API; shared intake; persistent guest/account drafts; exactly-once guest merge; Better Auth sessions and public role-escalation denial; admin catalogue lifecycle with audit/version checks; database-backed request throttling for application writes; multi-day schedule editing, personal zero-price blocks, lock/undo, day navigation, mobile library/edit dialogs, autosave/version recovery, deterministic proposal diff/apply, shared JSON Schema validation, server pricing, conservative zone buffers, service windows, hosting choices and explicit draft blockers.

Foundation features and core planner are implemented and API-tested; browser screenshots, keyboard flows and 390/768/1440px overflow inspection remain unverified because the connected browser inventory is empty. Do not mark A/B fully accepted until those checks pass. The intake parser is deliberately limited; it does not understand arbitrary conversation. No real AI provider, provider repair retry or validated real supply is connected.

Remaining: broader planner constraints/preferences and arrival add-ons; atomic full-bundle holds; immediate sandbox checkout; actual payment-provider verification/webhooks/reconciliation; operations and named assignments; companion/support; immutable changes and refunds. Automatic pricing and immediate checkout remain required; there is no request-a-quote replacement. Price estimates are not inventory promises. Full-day guide charges are suppressed when every activity already includes hosting; activity guides are not double-charged on hosted offers.

All prices, suppliers, capacity, zones and policies are fictional. Accessibility is unknown, not confirmed. Connectivity, phone numbers, supplier tickets, real identities, maps and tracking are absent. Missing commercial/provider setup is recorded in IMPLEMENTATION_PLAN.md and the original handoff docs/06.

## Validation evidence and limitations

2026-10-21: typecheck, lint and 19 unit tests passed (including all four supplied pricing cases). HTTP scripts passed draft ownership/conflicts; account sign-up/sign-in/session invalidation and one-time guest linking; planner persistence/exact total/locked preview/apply/stale proposal rollback; and admin review/verify/publish/pause/live-refusal. Public route HTTP smoke checks passed. Migrations 0001–0004 applied. Latest build result is recorded in docs/MILESTONE_STATUS.md. Browser tooling twice returned no available browsers/apps; screenshots, responsive overflow and keyboard journeys have NOT been checked. No full V1 acceptance, real PostgreSQL payment race or provider test has run.

`npm audit` reported five high development dependency findings through eslint-config-next → fast-glob → micromatch → braces. [Upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched braces release. Do not substitute an incompatible older Next lint configuration merely to suppress this report. Recheck before release; no clean full audit claim is made.

Dependency/API references checked: [Next installation](https://nextjs.org/docs/app/getting-started/installation), installed Next route/cookie guides in node_modules/next/dist/docs, [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [PGlite filesystem](https://pglite.dev/docs/filesystems). Next dev generated AGENTS.md with version-specific documentation instructions.

Account integration follows the checked [Better Auth installation](https://better-auth.com/docs/installation), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [core database schema](https://better-auth.com/docs/concepts/database) and [email/password guidance](https://better-auth.com/docs/authentication/email-password). Production email verification and trusted-proxy/distributed authentication throttling still require setup and testing.

## Local backup and rollback

Stop the app, copy `.local/demo-db` to a separate backup directory, then resume. Restore only with all app processes stopped. This is a local-demo procedure, not a tested production restore plan. For PostgreSQL, reviewed pg_dump/restore and deployment migration procedures remain release gates. Migration 0001 is additive/idempotent; do not drop tables to roll back. No deployment, external publication, provider connection or live charging was performed.
