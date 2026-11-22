---
step: B05
journey: Plan and book a trip
layer: Controller
file: src/modules/trips/presentation/http/controllers/intake-controller.ts
function: "createIntakeController"
line: 7
tags: [user-journey]
---
# B05 · Intake API › createIntakeController

`src/modules/trips/presentation/http/controllers/intake-controller.ts` → **`createIntakeController`** (line 7)

**The traveller:** Waits a moment.

**What runs:** Checks origin and caller, throttles, parses the request and calls the use case.

**Called from:** [[B04 Trip details › askKemi]] (POST /api/v1/intake)

**Next:**
- [[B06 SuggestProfile › execute]] — suggestProfile.execute()

Back to the story: [[User Journey]]
