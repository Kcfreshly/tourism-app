---
step: B27
journey: Plan and book a trip
layer: Repository
file: src/modules/trips/infrastructure/persistence/drizzle-trip-repository.ts
function: "DrizzleTripRepository.update"
line: 66
tags: [user-journey]
---
# B27 · Trip repository › update

`src/modules/trips/infrastructure/persistence/drizzle-trip-repository.ts` → **`DrizzleTripRepository.update`** (line 66)

**The traveller:** —

**What runs:** Updates the row where the version still matches; otherwise the planner shows a conflict and keeps the edits.

**Called from:** [[B26 SaveWorkspace › execute]] (trips.update()), [[B31 UpdateTripProfile › execute]] (trips.update())

Back to the story: [[User Journey]]
