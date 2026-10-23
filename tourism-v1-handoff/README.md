# Tourism V1 — coding-agent handoff

Prepared 21 October 2026. Specification version 1.0. Working product name: **Lagos, Your Way** (placeholder, not an approved brand).

## Start here

1. Give your coding agent this entire extracted directory, not only the prompt.
2. Paste `prompts/01_MASTER_BUILD_PROMPT.md` into its session.
3. Tell it which repository to use. In an existing repository it must inspect the existing stack and instructions before changing anything.
4. It should build a local demo first, then production adapters and checkout reliability. Use the milestone prompts to keep changes reviewable.
5. Replace demo catalogue data, rates, brand, imagery and policy configuration before accepting live bookings.

## Files and authority

| File | Purpose |
|---|---|
| `docs/01_PRODUCT_DESIGN.md` | Product requirements, complete screen specifications and interaction design |
| `docs/02_SYSTEM_AND_DATA.md` | Architecture, entities, state machines, permissions and API behavior |
| `docs/03_PRICING_AND_BOOKING.md` | Deterministic pricing, capacity, checkout, payment and cancellation rules |
| `docs/04_AI_AND_CONTENT.md` | Planner boundaries, research workflow and catalogue verification |
| `docs/05_BUILD_PLAN.md` | Four-week implementation plan, scope and release gates |
| `docs/06_ASSETS_AND_LAUNCH.md` | Asset manifest, image requirements, provider setup and operating readiness |
| `prompts/01_MASTER_BUILD_PROMPT.md` | Main instructions to coding agent |
| `prompts/02_MILESTONE_PROMPTS.md` | Focused build prompts in dependency order |
| `prompts/03_PLANNER_SYSTEM_PROMPT.md` | Runtime AI planning instructions |
| `prompts/04_RESEARCH_PROMPT.md` | Catalogue research and verification instructions |
| `data/*.json` | Explicitly fictional fixtures and example settings |
| `contracts/*.json` | Machine-readable JSON Schema contracts |
| `assets/design-tokens.css` | Reusable design primitives |
| `assets/wireframes/*.svg` | Six annotated screens/layout references; readable in browser/Figma |
| `assets/illustrations/*.svg` | Original category placeholders and draft brand mark |
| `qa/ACCEPTANCE.md` | Functional, integration and pilot acceptance scenarios |
| `qa/pricing-cases.json` | Exact arithmetic examples for implementation tests |

Priority: explicit user decisions recorded in product design > booking invariants > screen designs > reference wireframes > demo fixtures. New user instructions override this package. If documents conflict, preserve money/inventory invariants and record the discrepancy.

## Important scope corrections

- **Automatic pricing and immediate checkout** are core V1 behavior. Do not replace checkout with “request a quote.”
- Admin configures sellable supply, pricing, assignments and exceptions. Staff do not manually price every trip.
- The traveller can choose AI chat or a form; both populate the same editable trip profile.
- Include Lagos Life as a real category in V1 alongside nature, food, art, beaches and nightlife.
- Default to two main experiences plus one optional light experience; a full-day activity replaces the two main experiences.
- A mobile companion is part of V1 through a responsive web app. Native apps and background emergency alerts are deferred.

## Assumptions chosen to make a build possible

Lagos first; one city per itinerary; English; NGN settlement; adult-only demo checkout; one accommodation base; responsive web app; three assistance choices; 20–30 verified experiences at launch. These are implementation assumptions, not statements that the founder has approved every commercial detail. Abuja and more cities are future catalogue expansion. The code should use city identifiers rather than hardcoding Lagos throughout.

No venues, supplier names, prices, capacity, travel times or people in the fixtures have been verified. All fixture suppliers are fictional. No production credentials, licensed photographs, partner contracts or final legal policies are supplied. Their concrete requirements are listed in `docs/06_ASSETS_AND_LAUNCH.md`.

## What this package is

A build brief with design references, original vector placeholders, contracts and seed fixtures. It is not the application source, a deployed service, a finished identity or a claim that live integrations have been verified. Dependency versions and provider APIs must be checked against official documentation when implementing.
