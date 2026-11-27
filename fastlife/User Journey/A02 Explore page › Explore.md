---
step: A02
journey: Book one activity
layer: Page
file: src/app/explore/page.tsx
function: "Explore"
line: 9
tags: [user-journey]
---
# A02 · Explore page › Explore

`src/app/explore/page.tsx` → **`Explore`** (line 9)

**The traveller:** Sees every published activity, with filters for date, price, area and family.

**What runs:** Server page. Calls `pages.listPublishedExperiences()` to load supply, then renders the browser with the URL filters.

**Called from:** [[A01 Home page › Home]] (link /explore)

**Next:**
- [[S02 ListPublishedExperiences › execute]] — pages.listPublishedExperiences()
- [[A03 Catalogue browser › CatalogueBrowser]] — renders

Back to the story: [[User Journey]]
