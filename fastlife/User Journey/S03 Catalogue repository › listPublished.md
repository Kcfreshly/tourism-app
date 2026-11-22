---
step: S03
journey: Shared
layer: Repository
file: src/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository.ts
function: "DrizzleCatalogueRepository.listPublished"
line: 16
tags: [user-journey]
---
# S03 · Catalogue repository › listPublished

`src/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository.ts` → **`DrizzleCatalogueRepository.listPublished`** (line 16)

**The traveller:** —

**What runs:** `SELECT * FROM catalogue WHERE status = 'DEMO_PUBLISHED'`.

**Called from:** [[S02 ListPublishedExperiences › execute]] (catalogue.listPublished())

Back to the story: [[User Journey]]
