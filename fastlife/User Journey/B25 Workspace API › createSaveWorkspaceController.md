---
step: B25
journey: Plan and book a trip
layer: Controller
file: src/modules/trips/presentation/http/controllers/save-workspace-controller.ts
function: "createSaveWorkspaceController"
line: 12
tags: [user-journey]
---
# B25 · Workspace API › createSaveWorkspaceController

`src/modules/trips/presentation/http/controllers/save-workspace-controller.ts` → **`createSaveWorkspaceController`** (line 12)

**The traveller:** —

**What runs:** Checks origin, loads the caller's own trip, throttles, parses items and services.

**Called from:** [[B24 Planner › save (autosave)]] (PUT /workspace)

**Next:**
- [[S08 Owned trip › createOwnedTripLoader]] — ownedTrip(id)
- [[B26 SaveWorkspace › execute]] — saveWorkspace.execute()

Back to the story: [[User Journey]]
