---
step: S07
journey: Shared
layer: Controller
file: src/modules/trips/presentation/http/controllers/get-workspace-controller.ts
function: "createGetWorkspaceController"
line: 9
tags: [user-journey]
---
# S07 · Workspace API › createGetWorkspaceController

`src/modules/trips/presentation/http/controllers/get-workspace-controller.ts` → **`createGetWorkspaceController`** (line 9)

**The traveller:** —

**What runs:** `GET /api/v1/trips/<id>/workspace`: loads the caller's own trip, then the workspace.

**Called from:** [[B17 Planner › load workspace]] (GET /workspace), [[B30 Planner › saveBase]] (reload workspace), [[B34 Trip checkout › Checkout]] (GET /workspace)

**Next:**
- [[S08 Owned trip › createOwnedTripLoader]] — ownedTrip(id)
- [[S09 GetWorkspace › execute]] — getWorkspace.execute()

Back to the story: [[User Journey]]
