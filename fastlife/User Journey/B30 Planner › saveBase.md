---
step: B30
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "saveBase"
line: 322
tags: [user-journey]
---
# B30 · Planner › saveBase

`src/components/planner.tsx` → **`saveBase`** (line 322)

**The traveller:** Adds a pickup address (or area) from the warning and taps **Save address**.

**What runs:** `PATCH /api/v1/trips/<id>` with the updated profile, then reloads the workspace.

**Next:**
- [[B31 UpdateTripProfile › execute]] — PATCH /api/v1/trips/<id>
- [[S07 Workspace API › createGetWorkspaceController]] — reload workspace

Back to the story: [[User Journey]]
