# Activity overlay and fixed-header checks

Implemented a page-level activity overlay host so changing bucket membership cannot unmount an open activity. Ordinary dismissal returns focus to the exact image/title/detail trigger without scrolling. If the user removes the originating card from My Bucket, closing returns focus to the still-connected activity list instead.

Backdrop dismissal requires a primary pointer to begin and end outside the dialog with no drag movement. Inside clicks and inside-to-outside drags are ignored. The native modal retains Close and Escape, makes the underlying navbar/page inert, and keeps keyboard Tab navigation inside the dialog. Body scrolling is locked while it is open; page and ancestor panel scroll positions are restored on dismissal.

The modal header and action footer are outside the scrolling body. Desktop uses a stationary, contained gallery on the left and one scrollable information column on the right. Mobile uses a compact stationary image area beneath the header; screens up to 520px high use a 64px thumbnail row. Gallery controls are provided when multiple supplied photos exist. Images are not stretched.

The navbar and demo notice are in an opaque fixed wrapper. A ResizeObserver measures the entire wrapper and sets the page offset, including when navigation wraps on narrow screens. Root scroll padding and focus/anchor margins account for the header. Native dialog top-layer rendering places its backdrop above the fixed header; the header cannot receive pointer or keyboard interaction through the modal.

## Verification

`npm run test:overlays` passed in isolated Chromium with actual pointer, wheel and keyboard input:

- Backdrop, Close and Escape dismiss the modal and restore the initiating button's focus.
- Clicks and scrolling inside, and a pointer drag beginning inside and ending outside, do not dismiss it.
- Information scrolls while gallery, header and action footer retain the same bounds.
- Non-zero page, library and schedule scrolling, a non-empty search, and the saved itinerary survive dismissal.
- Removing a source card while reading leaves the overlay open.
- Website header remains at viewport top while real Explore content scrolls by more than 400px; main-anchor navigation is offset below it.
- Actions remain within the modal and information remains readable at 1440x900, 1280x800, 768x1024, 390x844, 390x480 and 844x390.
- No browser runtime errors.

The existing 34 unit/component tests, planner browser interactions, typecheck, lint, formatting and production build also pass. Scheduling and booking validation were not changed.

## Captures

- [Desktop reading](../artifacts/overlays/desktop-reading.png)
- [Laptop](../artifacts/overlays/laptop-overlay.png)
- [Tablet](../artifacts/overlays/tablet-overlay.png)
- [Mobile](../artifacts/overlays/mobile-overlay.png)
- [Short mobile / thumbnail](../artifacts/overlays/short-mobile-overlay.png)
- [Short landscape](../artifacts/overlays/landscape-overlay.png)
- [Fixed header on a scrolled desktop page](../artifacts/overlays/header-desktop-scrolled.png)
- [Fixed header on a scrolled mobile page](../artifacts/overlays/header-mobile-scrolled.png)
- [Machine-readable checks](../artifacts/overlays/checks.json)

Native Safari/iOS/Android browsers were not exercised. The underlying inventory and checkout remain the existing demo.
