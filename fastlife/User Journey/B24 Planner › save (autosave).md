---
step: B24
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "save"
line: 219
tags: [user-journey]
---
# B24 · Planner › save (autosave)

`src/components/planner.tsx` → **`save`** (line 219)

**The traveller:** Sees "Saved · estimate updated".

**What runs:** Runs 0.9 s after the last change (`setTimeout` effect, line 244): `PUT /api/v1/trips/<id>/workspace` with the version it loaded.

**Called from:** [[B22 Planner › change]] (dirty → autosave), [[B32 Checkout prompt › proceed]] (beforeLeave → save())

**Next:**
- [[B25 Workspace API › createSaveWorkspaceController]] — PUT /workspace

Back to the story: [[User Journey]]
