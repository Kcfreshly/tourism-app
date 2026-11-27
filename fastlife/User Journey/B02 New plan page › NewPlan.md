---
step: B02
journey: Plan and book a trip
layer: Page
file: src/app/plan/new/page.tsx
function: "NewPlan"
line: 5
tags: [user-journey]
---
# B02 · New plan page › NewPlan

`src/app/plan/new/page.tsx` → **`NewPlan`** (line 5)

**The traveller:** Signs in if needed, then sees the trip form.

**What runs:** Server page. `pages.requireSignedIn()` with the same query, then renders `Intake`.

**Called from:** [[B01 Home page › Plan with Kemi]] (link /plan/new)

**Next:**
- [[S01 Page guards › requireSignedIn]] — pages.requireSignedIn()
- [[B03 Trip details › Intake]] — renders

Back to the story: [[User Journey]]
