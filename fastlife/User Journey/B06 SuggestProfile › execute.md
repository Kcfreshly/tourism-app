---
step: B06
journey: Plan and book a trip
layer: Use case
file: src/modules/trips/application/use-cases/suggest-profile.ts
function: "SuggestProfile.execute"
line: 7
tags: [user-journey]
---
# B06 · SuggestProfile › execute

`src/modules/trips/application/use-cases/suggest-profile.ts` → **`SuggestProfile.execute`** (line 7)

**The traveller:** —

**What runs:** Runs the deterministic extractor and returns the suggested profile, what changed and any questions.

**Called from:** [[B05 Intake API › createIntakeController]] (suggestProfile.execute())

**Next:**
- [[B07 intake › extractProfile]] — extractProfile()

Back to the story: [[User Journey]]
