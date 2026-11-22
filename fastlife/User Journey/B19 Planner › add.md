---
step: B19
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "add"
line: 353
tags: [user-journey]
---
# B19 · Planner › add

`src/components/planner.tsx` → **`add`** (line 353)

**The traveller:** Sees the edit dialog with the first time that fits.

**What runs:** Finds valid start times, then opens the item in the edit dialog (`openItem`).

**Called from:** [[B18 Activity card › PlannerActivityCard]] (onAdd → add(offer))

**Next:**
- [[B20 planner › availableStarts]] — availableStarts()
- [[B21 Planner › commitCandidate]] — dialog submit

Back to the story: [[User Journey]]
