---
step: S06
journey: Shared
layer: Domain
file: src/modules/trips/domain/planner.ts
function: "placementIssues"
line: 770
tags: [user-journey]
---
# S06 · planner › placementIssues

`src/modules/trips/domain/planner.ts` → **`placementIssues`** (line 770)

**The traveller:** Sees why a time doesn't fit (e.g. "This time is already occupied").

**What runs:** The subset of `assess()` blockers that stop an item being placed at all; used by the planner, proposals and the API alike.

**Called from:** [[B20 planner › availableStarts]] (placementIssues()), [[B22 Planner › change]] (placementIssues()), [[B26 SaveWorkspace › execute]] (placementIssues()), [[B31 UpdateTripProfile › execute]] (placementIssues())

**Next:**
- [[S05 planner › assess]] — assess()

Back to the story: [[User Journey]]
