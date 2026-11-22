---
step: S02
journey: Shared
layer: Use case
file: src/modules/catalogue/application/use-cases/list-published-experiences.ts
function: "ListPublishedExperiences.execute"
line: 8
tags: [user-journey]
---
# S02 · ListPublishedExperiences › execute

`src/modules/catalogue/application/use-cases/list-published-experiences.ts` → **`ListPublishedExperiences.execute`** (line 8)

**The traveller:** —

**What runs:** Public supply: published rows only, each turned into a listing.

**Called from:** [[A02 Explore page › Explore]] (pages.listPublishedExperiences()), [[A05 Experience page › Detail]] (find() → listPublishedExperiences), [[A13 Cart › useCartView]] (GET /api/v1/experiences), [[S09 GetWorkspace › execute]] (offers.listPublished())

**Next:**
- [[S03 Catalogue repository › listPublished]] — catalogue.listPublished()
- [[S04 experience › toPublishedExperience]] — map(toPublishedExperience)

Back to the story: [[User Journey]]
