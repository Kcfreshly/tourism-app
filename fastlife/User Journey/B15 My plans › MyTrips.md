---
step: B15
journey: Plan and book a trip
layer: Component
file: src/components/my-trips.tsx
function: "MyTrips"
line: 39
tags: [user-journey]
---
# B15 · My plans › MyTrips

`src/components/my-trips.tsx` → **`MyTrips`** (line 39)

**The traveller:** Sees the trip card (with **Add your pickup address** if it's still missing) and taps **Open planner**.

**What runs:** Loads `GET /api/v1/trips`. The pickup flag comes from `pickupReminder()`.

**Called from:** [[B14 Active trip › activateTrip]] (link /trips?saved=<id>)

**Next:**
- [[S11 planner › pickupReminder]] — pickupReminder()
- [[B16 Plan page › Plan]] — Open planner

Back to the story: [[User Journey]]
