---
step: B17
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "Planner (load effect)"
line: 180
tags: [user-journey]
---
# B17 · Planner › load workspace

`src/components/planner.tsx` → **`Planner (load effect)`** (line 180)

**The traveller:** Sees their days, the activity library, the driver line for each day and the trip cost.

**What runs:** `GET /api/v1/trips/<id>/workspace` on load; keeps the trip, supply, transport settings and price.

**Called from:** [[B16 Plan page › Plan]] (renders)

**Next:**
- [[S07 Workspace API › createGetWorkspaceController]] — GET /workspace

Back to the story: [[User Journey]]
