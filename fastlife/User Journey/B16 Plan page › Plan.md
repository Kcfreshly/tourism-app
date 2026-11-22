---
step: B16
journey: Plan and book a trip
layer: Page
file: src/app/trips/[id]/plan/page.tsx
function: "Plan"
line: 3
tags: [user-journey]
---
# B16 · Plan page › Plan

`src/app/trips/[id]/plan/page.tsx` → **`Plan`** (line 3)

**The traveller:** Opens the day-by-day planner.

**What runs:** Server page. `pages.requireSignedIn()`, then renders `Planner`.

**Called from:** [[B15 My plans › MyTrips]] (Open planner)

**Next:**
- [[S01 Page guards › requireSignedIn]] — pages.requireSignedIn()
- [[B17 Planner › load workspace]] — renders

Back to the story: [[User Journey]]
