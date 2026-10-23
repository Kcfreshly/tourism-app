# Ọ̀nà redesign — design record

Customer-facing name: **Ọ̀nà** (Yoruba for "way" or "path"; *ọnà* also means craft or design), tagline **Lagos, your way**. It keeps continuity with the working name. Repository, package, storage keys, API routes and integration identifiers are unchanged. Kemi remains the assistant.

## Direction

- **Palette:** adire indigo (primary actions and brand), danfo yellow (counts, selection and highlights only, never body text), clay (editorial accents and set sessions), and lagoon green (personal time and success), all on warm sand paper. Tokens are in `src/app/tokens.css`, and text colours meet WCAG AA.
- **Type:** Bricolage Grotesque is used for display. It is OFL-licensed, self-hosted in `public/fonts`, and its subsets cover Yoruba diacritics. Body text uses the system UI font, so there is no runtime font CDN.
- **Imagery:** there are 13 locally stored Wikimedia Commons photos. Each experience now has a relevant image, and categories no longer repeat images. Every image's licence and author were verified through the Commons API by `scripts/download-nigeria-photos.py`. Images carry a "Destination inspiration" label and appear on `/photo-credits`.
- **Icons:** one inline SVG set (`src/components/icons.tsx`) with a 1.75px stroke on a 24px grid. It replaces glyphs such as ⠿ and ✳.
- **Motion:** 140–220ms ease-out for hover lift, dialog entry and the tray rising into view. All motion is disabled under `prefers-reduced-motion`.

## What changed in the journey

| Area | Change |
|---|---|
| Home | Plan with Kemi and Explore are two equal entry cards. A three-point promise strip covers saving vs booking vs times. Category tiles have distinct images, plus an honest "What we arrange" section and a labelled example day. |
| Explore | Sticky filter bar; cards show area, duration, teaser, timing type, host and price basis. A sticky bucket tray offers View bucket and Plan my trip. Bucket view has Clear (with confirm and Undo) and Keep exploring. The header bucket pill links straight to the bucket. |
| Onboarding | One sheet with a single header and a Close button. Talk to Kemi / Enter details manually are presented as cards. Kemi has a composer with voice input and parseable quick additions, and its follow-up questions now appear on the summary instead of being discarded. Saving inside the overlay opens the planner directly with the bucket preserved. |
| Planner | A toolbar with a save-state pill and a compact price summary (grouped breakdown in a popover). Proposal review and validation sit above the workspace instead of at the bottom, and issues link to their day. Day chips show item counts and Full. The library uses compact horizontal cards: the whole card is draggable, and each has a "Near your base · fits from 16:00" note. Timeline blocks are colour-coded by type, with icon actions, labelled resize edges and a full-day banner. The edit sheet can remove a block, and its day labels read as "Day N · date". |
| Services | Assistance levels are comparable radio cards instead of a select. |
| Detail overlay | Stationary full-bleed image, a fact grid, why it's worth it, when you can go (sessions as chips), included / not included, and good to know. The footer holds the price and actions. On mobile it becomes a bottom sheet. |
| Pocket day view (new) | `/trips/:id/today` is read-only and built from the saved itinerary. It shows next up, a timeline with free-time gaps, day stepping and a bottom tab bar. It never shows drivers, tickets or support numbers that don't exist. |
| Copy | Internal language such as "DEMO" suffixes, zone codes, "Africa/Lagos" and "fictional supply" has been removed from customer screens. One honest preview notice remains in the header. The staff workspace keeps its explicit operational language. |

## Unchanged by design

Scheduling validation, pricing arithmetic, session and opening-hour rules, overlap and full-day enforcement, server version checks, proposal confirmation, authentication, ownership and admin permissions are unchanged. Checkout is still not implemented; the UI says that booking isn't open and that nothing is reserved or charged.

## Verification (23 Oct 2026)

- `prettier --check`, `tsc --noEmit`, `eslint .` and 34 Vitest tests passed.
- The production build passed with `ALLOW_LOCAL_DEMO_BUILD=true`.
- These scripts passed against the dev server: `check-api`, `check-planner`, `check-account`, `check-journey`, `check-workspace` and `check-overlays`.
- `check-redesign` (new) passed. It covers save to bucket, tray and pill counts, clear and cancel, onboarding dismissal by Escape, Close and backdrop, Kemi onboarding that opens the planner with the bucket intact, the price breakdown, the day view, the skip link, the mobile menu, and no horizontal overflow at 1440, 768 and 390px.
- Script selectors were updated where labels intentionally changed. `check-overlays` now waits for the dialog entry animation to finish and opens a card that is visible after scrolling.
- `check-admin` was not run; it needs the admin fixture to be granted with the server stopped.
- Native Safari, iOS and Android were not tested.

Screenshots: `artifacts/redesign/before/` and `artifacts/redesign/after/` (01–12 at desktop, tablet and mobile). Regenerate them with `node scripts/capture-screens.mjs <label>`.
