---
step: A14
journey: Book one activity
layer: Domain
file: src/modules/bookings/domain/cart.ts
function: "cartTotals"
line: 102
tags: [user-journey]
---
# A14 · bookings cart › cartTotals

`src/modules/bookings/domain/cart.ts` → **`cartTotals`** (line 102)

**The traveller:** Sees the subtotal, service fee and total.

**What runs:** Sums payable lines and adds the service fee per line (half-up rounding), so one line's fee can be refunded on its own later.

**Called from:** [[A13 Cart › useCartView]] (view() + cartTotals())

Back to the story: [[User Journey]]
