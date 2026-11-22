---
step: A03
journey: Book one activity
layer: Component
file: src/components/catalogue-browser.tsx
function: "CatalogueBrowser"
line: 183
tags: [user-journey]
---
# A03 · Catalogue browser › CatalogueBrowser

`src/components/catalogue-browser.tsx` → **`CatalogueBrowser`** (line 183)

**The traveller:** Filters the list and opens an activity card.

**What runs:** Client component. Filters listings in the browser and renders `ExperienceCard`s. A card's image or title opens the overlay; with a date picked, **Book for <day>** links straight to the booking panel.

**Called from:** [[A02 Explore page › Explore]] (renders)

**Next:**
- [[A04 Experience overlay › ExperienceOverlay]] — opens card
- [[A05 Experience page › Detail]] — Book for <day>

Back to the story: [[User Journey]]
