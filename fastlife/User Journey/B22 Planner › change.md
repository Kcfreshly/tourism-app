---
step: B22
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "change → refitCars"
line: 297
tags: [user-journey]
---
# B22 · Planner › change

`src/components/planner.tsx` → **`change → refitCars`** (line 297)

**The traveller:** Sees the activity on the timeline and "Unsaved changes · updating estimate…".

**What runs:** Refits any day's car that's missing or no longer covers the day, refuses placements that break a rule, keeps undo history and marks the plan dirty.

**Called from:** [[B21 Planner › commitCandidate]] (change(items)), [[B29 Planner › day transport controls]] (change(items, services))

**Next:**
- [[B23 planner › fitCar]] — refitCars → fitCar / carCovers
- [[S06 planner › placementIssues]] — placementIssues()
- [[B24 Planner › save (autosave)]] — dirty → autosave

Back to the story: [[User Journey]]
