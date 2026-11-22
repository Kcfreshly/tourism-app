---
step: B32
journey: Plan and book a trip
layer: Component
file: src/components/checkout-prompt.tsx
function: "CheckoutButton.proceed"
line: 49
tags: [user-journey]
---
# B32 · Checkout prompt › proceed

`src/components/checkout-prompt.tsx` → **`CheckoutButton.proceed`** (line 49)

**The traveller:** Taps **Review and checkout** (and confirms if some days are still free).

**What runs:** Saves pending edits first (`beforeLeave` = the planner's `save()`), then goes to the trip checkout.

**Next:**
- [[B24 Planner › save (autosave)]] — beforeLeave → save()
- [[B33 Trip checkout page › CheckoutPage]] — router.push /trips/<id>/checkout

Back to the story: [[User Journey]]
