---
step: B13
journey: Plan and book a trip
layer: Repository
file: src/modules/trips/infrastructure/persistence/drizzle-trip-repository.ts
function: "DrizzleTripRepository.create"
line: 51
tags: [user-journey]
---
# B13 · Trip repository › create

`src/modules/trips/infrastructure/persistence/drizzle-trip-repository.ts` → **`DrizzleTripRepository.create`** (line 51)

**The traveller:** Sees "Saved" with next steps.

**What runs:** Inserts the account-owned `trips` row at version 1.

**Called from:** [[B11 CreateTrip › execute]] (trips.create())

**Next:**
- [[B14 Active trip › activateTrip]] — response

Back to the story: [[User Journey]]
