---
step: B20
journey: Plan and book a trip
layer: Domain
file: src/modules/trips/domain/planner.ts
function: "availableStarts"
line: 824
tags: [user-journey]
---
# B20 · planner › availableStarts

`src/modules/trips/domain/planner.ts` → **`availableStarts`** (line 824)

**The traveller:** —

**What runs:** Every start (sessions, or 15-minute steps that fit, late arrivals get a shorter visit) that passes `placementIssues()`.

**Called from:** [[B19 Planner › add]] (availableStarts())

**Next:**
- [[S06 planner › placementIssues]] — placementIssues()

Back to the story: [[User Journey]]
