---
step: S05
journey: Shared
layer: Domain
file: src/modules/trips/domain/planner.ts
function: "assess"
line: 319
tags: [user-journey]
---
# S05 · planner › assess

`src/modules/trips/domain/planner.ts` → **`assess`** (line 319)

**The traveller:** Sees the trip cost, "things to sort out before booking" and planning tips.

**What runs:** The pricing and rules engine: activities, opening hours, notice, travel time, overlaps (including the night before), day and night cars from the transport settings, late returns, guides, fees. Returns lines, blockers and warnings.

**Called from:** [[B26 SaveWorkspace › execute]] (assess()), [[S06 planner › placementIssues]] (assess()), [[S09 GetWorkspace › execute]] (assess())

**Next:**
- [[S11 planner › pickupReminder]] — pickupReminder()

Back to the story: [[User Journey]]
