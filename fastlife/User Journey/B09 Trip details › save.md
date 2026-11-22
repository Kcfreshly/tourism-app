---
step: B09
journey: Plan and book a trip
layer: Component
file: src/components/intake.tsx
function: "save"
line: 299
tags: [user-journey]
---
# B09 · Trip details › save

`src/components/intake.tsx` → **`save`** (line 299)

**The traveller:** Waits for "Saving your trip…".

**What runs:** Adds saved Bucket ideas, then `POST /api/v1/trips` (or `PATCH /api/v1/trips/<id>` when editing).

**Called from:** [[B08 Trip details › review]] (Save)

**Next:**
- [[B10 Trips API › createCreateTripController]] — POST /api/v1/trips

Back to the story: [[User Journey]]
