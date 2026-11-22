---
step: A13
journey: Book one activity
layer: Hook
file: src/components/cart.tsx
function: "useCartView"
line: 163
tags: [user-journey]
---
# A13 · Cart › useCartView

`src/components/cart.tsx` → **`useCartView`** (line 163)

**The traveller:** Sees each line with its date, time, guests and total.

**What runs:** Loads the catalogue once with `loadCatalogue()` (`GET /api/v1/experiences` → `createListExperiencesController`), then prices every cart line.

**Called from:** [[A16 Cart page › CartPage]] (useCartView()), [[A12 Checkout review › CheckoutReview]] (useCartView())

**Next:**
- [[S02 ListPublishedExperiences › execute]] — GET /api/v1/experiences
- [[A14 bookings cart › cartTotals]] — view() + cartTotals()

Back to the story: [[User Journey]]
