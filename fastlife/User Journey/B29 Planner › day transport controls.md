---
step: B29
journey: Plan and book a trip
layer: Component
file: src/components/planner.tsx
function: "setDayMode / setDayWindow / setNightCar / setOwnWayBack"
line: 829
tags: [user-journey]
---
# B29 · Planner › day transport controls

`src/components/planner.tsx` → **`setDayMode / setDayWindow / setNightCar / setOwnWayBack`** (line 829)

**The traveller:** Chooses car or own way for the day, the car's hours (or **Fit to my plan**), a night car, guides, or "I'll arrange our own way back".

**What runs:** Each control builds new services and calls `change()`; typing car times by hand skips the automatic refit.

**Called from:** [[B28 Driver & guides page › ServicesPage]] (renders)

**Next:**
- [[B22 Planner › change]] — change(items, services)

Back to the story: [[User Journey]]
