---
step: B04
journey: Plan and book a trip
layer: Component
file: src/components/intake.tsx
function: "askKemi"
line: 259
tags: [user-journey]
---
# B04 · Trip details › askKemi

`src/components/intake.tsx` → **`askKemi`** (line 259)

**The traveller:** Writes something like *"5 days in December, 2 adults, book a hotel for us"*.

**What runs:** `POST /api/v1/intake` with the current profile and the message. Nothing is saved yet.

**Called from:** [[B03 Trip details › Intake]] (Talk to Kemi)

**Next:**
- [[B05 Intake API › createIntakeController]] — POST /api/v1/intake

Back to the story: [[User Journey]]
