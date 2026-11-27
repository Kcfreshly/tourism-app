---
step: S09
journey: Shared
layer: Use case
file: src/modules/trips/application/use-cases/get-workspace.ts
function: "GetWorkspace.execute"
line: 14
tags: [user-journey]
---
# S09 · GetWorkspace › execute

`src/modules/trips/application/use-cases/get-workspace.ts` → **`GetWorkspace.execute`** (line 14)

**The traveller:** —

**What runs:** Returns the trip, published supply, the transport settings and a fresh price.

**Called from:** [[S07 Workspace API › createGetWorkspaceController]] (getWorkspace.execute())

**Next:**
- [[S02 ListPublishedExperiences › execute]] — offers.listPublished()
- [[S10 Transport settings › get]] — transport.get()
- [[S05 planner › assess]] — assess()

Back to the story: [[User Journey]]
