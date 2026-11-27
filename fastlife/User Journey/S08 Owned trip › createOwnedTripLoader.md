---
step: S08
journey: Shared
layer: Guard
file: src/modules/trips/presentation/http/owned-trip.ts
function: "createOwnedTripLoader → LoadOwnedTrip.execute"
line: 7
tags: [user-journey]
---
# S08 · Owned trip › createOwnedTripLoader

`src/modules/trips/presentation/http/owned-trip.ts` → **`createOwnedTripLoader → LoadOwnedTrip.execute`** (line 7)

**The traveller:** —

**What runs:** Requires a caller and returns the trip only if they own it; otherwise "Trip not found".

**Called from:** [[B25 Workspace API › createSaveWorkspaceController]] (ownedTrip(id)), [[S07 Workspace API › createGetWorkspaceController]] (ownedTrip(id))

Back to the story: [[User Journey]]
