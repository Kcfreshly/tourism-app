# One-month delivery plan

Assumption: one focused full-time builder using a coding agent, plus a dependable local person handling partners. A month is an ambitious controlled-pilot target, not a promise that every integration or supplier will be ready. Build one complete slice early rather than every screen as a disconnected mockup.

## Week 1 — foundation and real constraints

Days 1–2: inspect repository, record architecture decision, set up workspace/database/migrations, seed fixtures, design tokens, shells and authentication boundaries. Build home, explore and detail routes.

Days 3–5: unified trip profile, guest draft/sign-in merge, trip CRUD, catalogue administration and publish validation. Add editable one-day timeline with accessible add/move controls. Implement pure pricing functions and exact demo cases.

Parallel groundwork: local lead confirms initial service zones, first experiences, vehicle/guide capacity, rate and cancellation agreements. Growth owner conducts customer conversations and collects interest; avoid presenting unverified products as already bookable.

Exit: user can create and reload a draft, add verified demo activities and see server-generated prices. Data stored in database, not just browser state.

## Week 2 — coherent planning

Days 6–8: multi-day planning, custom blocks, durations, time buffers, services selection, admin rate/slot configuration. Add pointer drag-and-drop if core move controls are stable; preserve keyboard/mobile alternatives.

Days 9–10: catalogue-grounded model adapter, structured plan generation, deterministic validation/repair, proposal diff/apply and locked items. Integrate zone/time-band estimates with explicit unknown-route blockers.

Exit: coherent seven-day fixture plan can be generated, edited and repriced with no invalid IDs or missing travel/support windows.

## Week 3 — booking and delivery

Days 11–13: transactional inventory holds, idempotent checkout, hosted payment sandbox, signed webhook inbox, verification/reconciliation and immutable order. Test concurrent last-seat purchase and hold/webhook race.

Days 14–15: staff trip queue, driver/guide assignment, supplier confirmation/ticket states, companion Today/Plan/Bookings, support requests and notification outbox.

Exit: complete sandbox journey from intake to verified payment, reserved capacity, published assignment and mobile itinerary. Browser redirect alone cannot confirm payment.

## Week 4 — pilot readiness

Days 16–18: change/cancel requests and refund state handling, provider failures, mobile/accessibility QA, privacy controls, cache behavior, operator workflow rehearsal.

Days 19–20: supplier data replacement, live readiness checks, test restore, monitoring/runbook and supervised pilot. Reserve remaining calendar days for defects and partner delays rather than new features.

Exit: acceptance cases pass, operations rehearse failure scenarios, actual sellable inventory is verified, live credentials/configuration approved and support coverage staffed. If these are unmet, ship a working demo/private pilot and keep live checkout off.

## Priority when time runs short

P0: persistent intake/catalogue/planner, transparent deterministic pricing, atomic capacity holds, verified payment, order status, assignments, mobile companion, staff exception queue, clear support, access control. P1: AI polish, drag-and-drop polish, cached itinerary, admin convenience features. P2: sophisticated animations, map visualisation, broad catalogue, real-time chat, native apps and automatic alerts.

AI may use a deterministic planner fallback during provider outage; it cannot use a fake paid state. Cut UI decoration before cutting transaction integrity.

## Owner setup checklist

Owner chooses brand/city/support hours and approves commercial policy. Local lead verifies supply and rate/capacity agreements. Builder configures providers and deployment. One named operator owns each active trip and urgent request. Written guide/driver instructions cover pickup, delays, identity, no-show, replacement, hours and escalation. Keep an actual fallback vehicle/host arrangement where sold coverage depends on it.

## Handoff completion evidence

Agent delivers changed-file summary; setup/run commands; exact checks run and results; screenshots at mobile/desktop widths; demo account usage without exposing credentials in public code; provider sandbox reference walkthrough; remaining gaps and disabled flags. No unsupported “production ready” claim. Build and unit tests alone do not demonstrate successful live fulfilment.
