---
step: B10
journey: Plan and book a trip
layer: Controller
file: src/modules/trips/presentation/http/controllers/create-trip-controller.ts
function: "createCreateTripController"
line: 7
tags: [user-journey]
---
# B10 · Trips API › createCreateTripController

`src/modules/trips/presentation/http/controllers/create-trip-controller.ts` → **`createCreateTripController`** (line 7)

**The traveller:** —

**What runs:** Checks origin, parses `profileSchema`, requires a caller, throttles trip creation, returns 201.

**Called from:** [[B09 Trip details › save]] (POST /api/v1/trips)

**Next:**
- [[B11 CreateTrip › execute]] — createTrip.execute()

Back to the story: [[User Journey]]
