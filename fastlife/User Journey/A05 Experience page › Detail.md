---
step: A05
journey: Book one activity
layer: Page
file: src/app/experiences/[slug]/page.tsx
function: "Detail"
line: 42
tags: [user-journey]
---
# A05 · Experience page › Detail

`src/app/experiences/[slug]/page.tsx` → **`Detail`** (line 42)

**The traveller:** Arrives on the activity page with the booking panel already open.

**What runs:** Server page. `find(slug)` looks the listing up in published supply; `listingDetails()` adds operator, venue and terms. Passes `today`, `now` and the late-return time (`pages.transportSettings()`) to the panel.

**Called from:** [[A03 Catalogue browser › CatalogueBrowser]] (Book for <day>), [[A04 Experience overlay › ExperienceOverlay]] (link ?book=1)

**Next:**
- [[S02 ListPublishedExperiences › execute]] — find() → listPublishedExperiences
- [[S10 Transport settings › get]] — pages.transportSettings()
- [[A06 Booking panel › Panel]] — renders, startOpen

Back to the story: [[User Journey]]
