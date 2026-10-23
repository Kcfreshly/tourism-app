---
name: ui-formatting
description: Refine web application layouts and user journeys when implementing or correcting forms, cards, navigation, activity libraries, dialogs, and responsive screens. Apply to tourism-app UI changes and similar frontend formatting work.
---

# UI formatting and journey review

Before changing a screen, identify the current step, its primary action, the next screen, and what user state must survive. For tourism-app, use talk or manual details -> editable summary -> saved draft -> explore or planner. Keep the full form out of the agent conversation until the user chooses manual editing.

Reuse the application's spacing, type, colour and control tokens. Group related actions in wrapping flex/grid containers, separate prices from actions, and give selected controls a persistent visual state plus `aria-pressed`. Use scoped classes for image and title triggers; never let heading styles restyle dialog contents.

For bounded lists, inspect the entire ancestor chain: grid/flex children need `min-width: 0` and `min-height: 0`; the list needs a bounded height and `overflow-y: auto` or `scroll`. Keep controls outside the scrolling list. Do not hide scrollbars. For image-card grids inside bounded flex panels, give auto rows enough intrinsic height (for example grid-auto-rows: max-content) so grid sizing does not shrink cards and clip their actions. Verify that each card contains its text and buttons and that the last item is reachable with a pointer and keyboard, including inside mobile dialogs. Do not repair clipping with `overflow: hidden`.

Check desktop, tablet and narrow mobile layouts. Check long names, empty and populated lists, selected/unselected buttons, and dialog content. Ensure labels, prices and buttons do not collide, images have deliberate aspect ratios and object fitting, and navigation wraps without horizontal page overflow.

Use an available browser to inspect screenshots and exercise the changed journey, including scrolling to the final item and returning from dialogs. Fix visual defects before delivery. If no browser is available, inspect layout constraints and run relevant checks, then explicitly report the visual verification limitation; never claim a screenshot review happened.

For downloaded photography, verify its depicted location and reuse licence, store assets locally, and retain source, author, licence links and modification notes. Label destination inspiration as such when the catalogue offer is fictional.

Run formatting, typechecking and lint checks appropriate to changed code. Use behaviour tests for meaningful journey transitions and schedule/data invariants; formatting tools alone do not prove a layout is usable.
