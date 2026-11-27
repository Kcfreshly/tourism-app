---
step: S11
journey: Shared
layer: Domain
file: src/modules/trips/domain/planner.ts
function: "pickupReminder"
line: 170
tags: [user-journey]
---
# S11 · planner › pickupReminder

`src/modules/trips/domain/planner.ts` → **`pickupReminder`** (line 170)

**The traveller:** Sees "Add your pickup address by …" until they add it.

**What runs:** For travellers booking their own stay with no address: the first car pickup minus the reminder hours. Never a blocker.

**Called from:** [[B15 My plans › MyTrips]] (pickupReminder()), [[S05 planner › assess]] (pickupReminder())

Back to the story: [[User Journey]]
