---
step: B11
journey: Plan and book a trip
layer: Use case
file: src/modules/trips/application/use-cases/create-trip.ts
function: "CreateTrip.execute"
line: 12
tags: [user-journey]
---
# B11 · CreateTrip › execute

`src/modules/trips/application/use-cases/create-trip.ts` → **`CreateTrip.execute`** (line 12)

**The traveller:** —

**What runs:** Keeps only Bucket ideas that are still published, then creates the trip with empty services.

**Called from:** [[B10 Trips API › createCreateTripController]] (createTrip.execute())

**Next:**
- [[B12 OfferSelection › keepPublished]] — selection.keepPublished()
- [[B13 Trip repository › create]] — trips.create()

Back to the story: [[User Journey]]
