---
step: A16
journey: Book one activity
layer: Component
file: src/components/cart.tsx
function: "CartPage"
line: 347
tags: [user-journey]
---
# A16 · Cart page › CartPage

`src/components/cart.tsx` → **`CartPage`** (line 347)

**The traveller:** Reviews everything in the cart, edits or removes lines, and taps **Review and checkout**.

**What runs:** Uses `useCartView()` for prices and problems per line, then links to `/checkout`.

**Called from:** [[A09 Booking panel › bookNow]] (Add to cart → View cart)

**Next:**
- [[A13 Cart › useCartView]] — useCartView()
- [[A11 Checkout page › Checkout]] — link /checkout

Back to the story: [[User Journey]]
