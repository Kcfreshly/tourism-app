---
step: B08
journey: Plan and book a trip
layer: Component
file: src/components/intake.tsx
function: "review"
line: 205
tags: [user-journey]
---
# B08 · Trip details › review

`src/components/intake.tsx` → **`review`** (line 205)

**The traveller:** Checks the summary and taps **Save**.

**What runs:** Validates with `profileSchema` and refuses an arrival date in the past before showing the summary.

**Called from:** [[B03 Trip details › Intake]] (Next: check summary), [[B07 intake › extractProfile]] (summary)

**Next:**
- [[B09 Trip details › save]] — Save

Back to the story: [[User Journey]]
