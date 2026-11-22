---
step: B23
journey: Plan and book a trip
layer: Domain
file: src/modules/trips/domain/planner.ts
function: "fitCar / carCovers"
line: 110
tags: [user-journey]
---
# B23 · planner › fitCar

`src/modules/trips/domain/planner.ts` → **`fitCar / carCovers`** (line 110)

**The traveller:** Sees **Driver 08:45–16:45 · 8 hours** above the day.

**What runs:** Pickup = first activity minus the rush-hour drive from the base; return = last activity plus the drive back; the shortest staff-configured block that covers both. Night cars start no earlier than the night start time.

**Called from:** [[B22 Planner › change]] (refitCars → fitCar / carCovers)

Back to the story: [[User Journey]]
