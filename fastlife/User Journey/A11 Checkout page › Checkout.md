---
step: A11
journey: Book one activity
layer: Page
file: src/app/checkout/page.tsx
function: "Checkout"
line: 6
tags: [user-journey]
---
# A11 · Checkout page › Checkout

`src/app/checkout/page.tsx` → **`Checkout`** (line 6)

**The traveller:** Is asked to sign in if they browsed as a guest; otherwise sees the review.

**What runs:** Server page. `pages.requireSignedIn('/checkout')`, then renders `CheckoutReview`.

**Called from:** [[A09 Booking panel › bookNow]] (router.push /checkout), [[A16 Cart page › CartPage]] (link /checkout)

**Next:**
- [[S01 Page guards › requireSignedIn]] — pages.requireSignedIn()
- [[A12 Checkout review › CheckoutReview]] — renders

Back to the story: [[User Journey]]
