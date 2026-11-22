---
step: A10
journey: Book one activity
layer: Hook
file: src/hooks/use-cart.ts
function: "useCart().add → write"
line: 51
tags: [user-journey]
---
# A10 · use-cart › useCart.add

`src/hooks/use-cart.ts` → **`useCart().add → write`** (line 51)

**The traveller:** Nothing visible: the cart badge in the header goes up by one.

**What runs:** Gives the line an id and writes the cart to this browser's `localStorage`. No server call: guests can fill a cart.

**Called from:** [[A09 Booking panel › bookNow]] (cart.add(line))

Back to the story: [[User Journey]]
