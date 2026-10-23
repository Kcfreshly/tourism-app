# V1 implementation plan

Reviewed the complete tourism-v1-handoff: README first, master prompt, docs 01–06, all prompts, JSON contracts and fixtures, CSV templates, six SVG wireframes, illustrations, tokens, manifest and QA criteria. Repository initially contained only the handoff and an older product-flow draft, with no application or AGENTS.md.

## Architecture and decisions

TypeScript modular Next.js App Router application; Drizzle schema and PostgreSQL. Local demo uses disk-backed PGlite (embedded PostgreSQL) because no PostgreSQL daemon is available; DATABASE_URL selects standard PostgreSQL. Production concurrency evidence must use independent PostgreSQL connections, not embedded tests. pnpm scripts, runtime Zod validation, server-side owner boundaries and versioned writes. Original illustrations and ivory/forest/terracotta tokens.

Package-manager deviation: npm lockfile and npm scripts are authoritative; pnpm may run the same scripts. Account authentication, transactional guest merge and audited demo catalogue administration are now implemented. Foundation and core planner are API-tested; A/B acceptance still awaits browser checks. Do not report full V1 completion.

Automatic deterministic prices and immediate checkout remain core. The older asset/Tourism_Product_Flow.md manual quotation gate is superseded by the handoff. Milestone A explicitly excludes payment; do not disguise an incomplete payment implementation as checkout.

## Milestones

- A: foundation, repeatable demo seed/migration, catalogue/detail, unified profile shell, durable guest drafts, identity merge and catalogue publish gates.
- B: multi-day editable schedule, locks/proposal apply, route validation, services and integer pricing.
- C: full-bundle atomic holds, persisted idempotency, provider sandbox verification, inbox/outbox, expiry/reconciliation and payment races on real PostgreSQL.
- D: operational queues, eligible assignments, supplier ticket states, companion and support.
- E: immutable booked changes, refund workflow, full acceptance, responsive/accessibility evidence and operational runbooks.

## Reversible assumptions and release gaps

Lagos city identifier, English, Africa/Lagos service time, NGN, 1–8 adults, 1–30 days, fixed accommodation base. Working brand unapproved. All supplied listings, rates, routes, capacity and identities fictional. Demo-only identity must refuse production. No live keys, licensed photos, supplier agreements, approved policies/tax, verified personnel, support staffing or connectivity partner supplied. Live operation disabled. AI intake initially a structured shell/deterministic helper, not a live model integration. No invented contact numbers, tickets, reviews or tracking.

## Validation

Validate supplied JSON schemas with a full validator. Test request validation, ownership, optimistic conflicts and draft persistence. Verify production refusal. Later milestones add exact pricing cases and all payment/assignment races. Run typecheck, lint, tests, build and inspect desktop/mobile screens. Record actual results and incomplete acceptance criteria; a green build is not launch readiness.
