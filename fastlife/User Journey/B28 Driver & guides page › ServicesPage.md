---
step: B28
journey: Plan and book a trip
layer: Page
file: src/app/trips/[id]/services/page.tsx
function: "ServicesPage"
line: 3
tags: [user-journey]
---
# B28 · Driver & guides page › ServicesPage

`src/app/trips/[id]/services/page.tsx` → **`ServicesPage`** (line 3)

**The traveller:** Taps **Driver & guides** (or a "Fix in Driver & guides" link on a warning).

**What runs:** Server page. Renders `Planner` with `servicesOnly`.

**Next:**
- [[S01 Page guards › requireSignedIn]] — pages.requireSignedIn()
- [[B29 Planner › day transport controls]] — renders

Back to the story: [[User Journey]]
