---
step: B31
journey: Plan and book a trip
layer: Use case
file: src/modules/trips/application/use-cases/update-trip-profile.ts
function: "UpdateTripProfile.execute"
line: 23
tags: [user-journey]
---
# B31 · UpdateTripProfile › execute

`src/modules/trips/application/use-cases/update-trip-profile.ts` → **`UpdateTripProfile.execute`** (line 23)

**The traveller:** Sees "Saved · pickups from …"; the reminder disappears.

**What runs:** Refuses a profile that would make the plan invalid, then saves it with a version check (via `createUpdateTripProfileController`).

**Called from:** [[B30 Planner › saveBase]] (PATCH /api/v1/trips/<id>)

**Next:**
- [[S06 planner › placementIssues]] — placementIssues()
- [[B27 Trip repository › update]] — trips.update()

Back to the story: [[User Journey]]
