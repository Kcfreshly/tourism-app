# Paste this into the coding agent

You are building the first controlled-release version of an AI-assisted Nigerian tourism application. The attached `tourism-v1-handoff` directory is your build contract. Build working software, not only a landing page or static mockup. Work locally in the repository provided by the owner; do not publish or enable live payments without a subsequent instruction.

## Read first

Read README, docs 01–06, contracts, fixtures, wireframe SVGs and QA cases. Inspect repository instructions and existing code before choosing implementation details. Preserve a compatible existing stack. For a new repo use a TypeScript modular monolith, React/Next.js frontend, Express API, PostgreSQL/Drizzle, pnpm workspace, unless a simpler coherent full-stack Next.js structure is materially faster. Verify current dependencies/provider behavior against official documentation; do not copy outdated SDK calls from memory.

Create `IMPLEMENTATION_PLAN.md` summarising chosen architecture, assumptions, milestones and release gaps. Do not spend the session only planning; implement the first vertical slice immediately, then progress through the milestones in `02_MILESTONE_PROMPTS.md`. Ask only when an ambiguity blocks safe implementation; otherwise record a reversible assumption and continue.

## Non-negotiable product behavior

1. AI chat and form populate one persisted editable trip profile.
2. Catalogue-driven itinerary with configurable days/times, add/remove/move, personal blocks and lock-aware AI proposals. Desktop library + timeline + price panel; mobile single-day layout with add/move sheet. Drag-and-drop has keyboard/button alternatives.
3. Default two main plus optional light experience; full-day outing replaces daytime main activities. Include Lagos Life in V1 and respect fixed accommodation and route buffers.
4. **Automatic deterministic pricing and immediate checkout. Never substitute a request-a-quote flow.** Staff configure supply/rates and manage delivery/exceptions.
5. Reserve the full bundle of activity, vehicle, guide and arrival capacity before payment. No overselling. Verify payment on the server; redirects never prove success.
6. Persist independent payment, reservation, ticket and assignment states. Build idempotency, reconciliation and a paid-but-unfulfilled exception path.
7. Pocket companion shows Today, Plan, Bookings, assigned identity details, actual pending states and support. Staff dashboard manages fulfilment, catalogue, capacity, assignments and incidents.
8. No invented venues/prices/ratings/people presented as real. All supplied fixture data is fictional and visibly demo-only.
9. No background emergency/location-monitoring promises. Optional one-time location sharing requires consent; support remains usable without it.
10. Auth, ownership checks and role restrictions are server-enforced. Never rely on hidden admin navigation for security.

## Build approach

Implement in dependency order. Deliver a usable database-backed demo with deterministic adapters, then wire sandbox integrations. Keep adapters explicit and production refusal guards strict. Do not stall on missing live keys; implement the integration boundary, sandbox path and exact setup instructions while disabling live operation.

Use supplied tokens and original vectors. Create a polished, calm travel interface with ivory/forest/terracotta. Use accessible real controls, concise copy, loading/empty/error/stale states and responsive layout. The SVGs are references, not image screenshots to place in the UI. Rebuild the components in code. Do not add fake maps, QR tickets or live tracking.

Use runtime request validation and shared contracts; extend provided schemas rather than trusting model JSON. Money is integer minor units with defined rounding. Dates use Africa/Lagos local service time independent of browser timezone. Atomic DB inventory and idempotent payment handling are mandatory.

## Definition of done

- New customer can create a draft, generate/edit schedule, choose services, see exact price, pay in sandbox, reload a verified order and view companion.
- Operator can configure approved supply, see upcoming work, assign eligible personnel, record supplier refs and handle support/refund exceptions.
- Customer cannot access another user's trip or any admin mutation.
- Tests cover deterministic pricing, validation, concurrent last-unit booking, replayed webhook, payment amount mismatch, hold expiry race, late success and assignment overlap.
- Mobile 390px and desktop 1440px routes inspected; all primary actions operable by keyboard; no horizontal page overflow.
- README, env template, migrations/seeds, scripts, CI checks and release runbook complete.

Run appropriate lint/typecheck/tests/build. Inspect rendered key screens at desktop/mobile sizes. Report exactly what ran, what passed, what remains mocked, missing owner configuration and live-launch blockers. Do not claim production readiness from a successful build alone.

Start now with repository inspection, a short implementation plan and the foundation/catalogue-to-draft vertical slice.
