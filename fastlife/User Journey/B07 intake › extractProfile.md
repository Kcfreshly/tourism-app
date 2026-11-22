---
step: B07
journey: Plan and book a trip
layer: Domain
file: src/modules/trips/domain/intake.ts
function: "extractProfile"
line: 12
tags: [user-journey]
---
# B07 · intake › extractProfile

`src/modules/trips/domain/intake.ts` → **`extractProfile`** (line 12)

**The traveller:** Sees the summary filled in from their words.

**What runs:** Reads dates, party size, interests, budget, guides, "own transport" and "book … hotel" (sets `accommodationBy: FASTLIFE`) from the text.

**Called from:** [[B06 SuggestProfile › execute]] (extractProfile())

**Next:**
- [[B08 Trip details › review]] — summary

Back to the story: [[User Journey]]
