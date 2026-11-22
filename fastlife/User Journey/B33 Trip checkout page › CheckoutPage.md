---
step: B33
journey: Plan and book a trip
layer: Page
file: src/app/trips/[id]/checkout/page.tsx
function: "CheckoutPage"
line: 5
tags: [user-journey]
---
# B33 · Trip checkout page › CheckoutPage

`src/app/trips/[id]/checkout/page.tsx` → **`CheckoutPage`** (line 5)

**The traveller:** Opens the trip review.

**What runs:** Server page. `pages.requireSignedIn()`, then renders `Checkout`.

**Called from:** [[B32 Checkout prompt › proceed]] (router.push /trips/<id>/checkout)

**Next:**
- [[S01 Page guards › requireSignedIn]] — pages.requireSignedIn()
- [[B34 Trip checkout › Checkout]] — renders

Back to the story: [[User Journey]]
