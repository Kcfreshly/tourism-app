# Planner workspace verification

## Implemented

The planner now uses the desktop width for a two-panel library and time grid. The default library allocation is 35%; the pointer- and keyboard-adjustable divider enforces usable minimum widths and remembers its position locally. Reset layout restores the default. At 900px and below, Activities and My schedule tabs replace the split.

The library shows compact tabs and filters followed immediately by image cards. Cards use licensed local destination imagery, separate bucket and Add to day actions, a dedicated drag handle, price basis and scheduling labels. Broken images use a category illustration. Intrinsic grid rows prevent card contents from being compressed or clipped. The activity list and schedule scroll independently; all last-row actions remain reachable.

The schedule uses a proportional minute scale and 15-minute drop positions. Flexible visits have pointer and keyboard resize edges with time/duration previews. Invalid placements retain the original block. Fixed sessions have no resize edges, and the edit dialog offers sessions passing the same placement validation. Full-day blocks mark the day full and reject additional personal or activity blocks. Personal blocks, travel and experiences have distinct styles.

The server remains the scheduling and price authority. This change does not change pricing formulae, opening-hour constraints, capacity rules, session durations, travel buffers, version checks or proposal confirmation. Edits continue to save and recalculate automatically. Duration changes do not invent duration-based prices for offers whose existing price basis is per adult or per group.

Clear bucket confirms before updating the browser shortlist, never sends a schedule mutation, and supports Undo. Explore more experiences carries the current trip in the URL and offers Open trip planner on return. Detail dialogs retain the selected day, search and edits.

The total and Review services action remain in a compact toolbar. Cost details expand on demand. Checkout is clearly unavailable; no payment is implied. The existing page banner is the single demo notice.

## Checks performed

- 34 Vitest domain/component tests: money and scheduling, onboarding, independent drafts, bucket clear/cancel/undo safety, keyboard split persistence, quarter-hour resize calculations and image fallback.
- Existing API, planner and account integration checks: ownership, CSRF, optimistic versions, rejected conflicting writes, unchanged stored plans after rejection, proposal preview/apply and locks.
- Chromium pointer tests: divider resize/persistence/reset, flexible end resize, rejected opening-hour change, schedule moves, library-to-grid drag and Add to day without accidental drag.
- Chromium fixed-session and full-day checks: disabled arbitrary time controls, no resize handles, full-day indicator and rejection of personal time on a full day.
- Chromium navigation checks: clear/cancel/Undo leaves the complete itinerary unchanged; Explore -> save another activity -> planner retains saved edits and the new selection; detail overlay retains search.
- Responsive visual inspection and captures at 1440x1000, 1280x900, 768x1024 and 390x844. The screenshots use exact viewport dimensions. Both mobile/tablet tabs were inspected. Card actions stay within their cards, the final library card can be reached, and no horizontal page overflow occurs.
- Typecheck, ESLint, Prettier and production build.

## Screenshots

- [Desktop 1440px](../artifacts/planner/desktop-1440.png)
- [Laptop 1280px](../artifacts/planner/laptop-1280.png)
- [Tablet activities 768px](../artifacts/planner/tablet-768-activities.png)
- [Tablet schedule 768px](../artifacts/planner/tablet-768-schedule.png)
- [Mobile activities 390px](../artifacts/planner/mobile-390-activities.png)
- [Mobile schedule 390px](../artifacts/planner/mobile-390-schedule.png)
- [Machine-readable browser checks](../artifacts/planner/checks.json)

## Reproduce

Run the local app, then `npm run test:workspace`. The script uses an isolated Chromium context, creates fictional QA drafts and writes screenshots and check results to artifacts/planner. It expects Playwright Chromium in .local/playwright-browsers (or PLAYWRIGHT_BROWSERS_PATH). Install with that environment variable and `npx playwright install chromium --no-shell` when needed. It does not use personal browser sessions or real payments.

## Remaining limitations

The browser run uses Chromium with responsive desktop viewports; it does not establish native Safari/iOS/Android touch behaviour. Mobile users have Add to day and the edit dialog as alternatives to native HTML drag and resize. Inventory and checkout remain the application's existing local demo, and there is no live paid-booking/change-request implementation to exercise.
