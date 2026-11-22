---
step: A09
journey: Book one activity
layer: Component
file: src/components/booking-panel.tsx
function: "bookNow → commit"
line: 260
tags: [user-journey]
---
# A09 · Booking panel › bookNow

`src/components/booking-panel.tsx` → **`bookNow → commit`** (line 260)

**The traveller:** Taps **Book now** (or **Add to cart** to keep browsing).

**What runs:** `commit()` stops if anything in `problems` is outstanding, then adds the line to the cart. `bookNow()` then goes to `/checkout`; `addToCart()` shows a toast with **View cart** instead.

**Called from:** [[A06 Booking panel › Panel]] (Book now)

**Next:**
- [[A10 use-cart › useCart.add]] — cart.add(line)
- [[A11 Checkout page › Checkout]] — router.push /checkout
- [[A16 Cart page › CartPage]] — Add to cart → View cart

Back to the story: [[User Journey]]
