---
step: B34
journey: Plan and book a trip
layer: Finish
file: src/components/checkout.tsx
function: "Checkout"
line: 40
tags: [user-journey]
---
# B34 · Trip checkout › Checkout

`src/components/checkout.tsx` → **`Checkout`** (line 40)

**The traveller:** Sees free days, anything still blocking payment, the pickup address reminder if it's missing, the cost by day, and **Pay** (disabled in this preview).

**What runs:** Loads the workspace (same chain as the planner). Blockers come from `assess()`; the pickup reminder is a warning, never a blocker. End of the journey today.

**Called from:** [[B33 Trip checkout page › CheckoutPage]] (renders)

**Next:**
- [[S07 Workspace API › createGetWorkspaceController]] — GET /workspace

Back to the story: [[User Journey]]
