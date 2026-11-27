---
step: B26
journey: Plan and book a trip
layer: Use case
file: src/modules/trips/application/use-cases/save-workspace.ts
function: "SaveWorkspace.execute"
line: 22
tags: [user-journey]
---
# B26 · SaveWorkspace › execute

`src/modules/trips/application/use-cases/save-workspace.ts` → **`SaveWorkspace.execute`** (line 22)

**The traveller:** —

**What runs:** Re-checks placement on the server, prices with the current transport settings, then saves only if no other tab saved first (version check).

**Called from:** [[B25 Workspace API › createSaveWorkspaceController]] (saveWorkspace.execute())

**Next:**
- [[S06 planner › placementIssues]] — placementIssues()
- [[S10 Transport settings › get]] — transport.get()
- [[S05 planner › assess]] — assess()
- [[B27 Trip repository › update]] — trips.update()

Back to the story: [[User Journey]]
