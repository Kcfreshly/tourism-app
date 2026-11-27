---
step: B14
journey: Plan and book a trip
layer: Hook
file: src/hooks/use-active-trip.ts
function: "activateTrip"
line: 14
tags: [user-journey]
---
# B14 · Active trip › activateTrip

`src/hooks/use-active-trip.ts` → **`activateTrip`** (line 14)

**The traveller:** Taps **Go to my drafts** (or **Explore experiences** to add more ideas).

**What runs:** Remembers this trip as the active one in the browser, so "Add to trip" buttons elsewhere know where to add.

**Called from:** [[B13 Trip repository › create]] (response)

**Next:**
- [[B15 My plans › MyTrips]] — link /trips?saved=<id>

Back to the story: [[User Journey]]
