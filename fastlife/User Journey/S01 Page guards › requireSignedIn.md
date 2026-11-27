---
step: S01
journey: Shared
layer: Guard
file: src/modules/identity/presentation/pages/page-guards.ts
function: "requireSignedIn"
line: 8
tags: [user-journey]
---
# S01 · Page guards › requireSignedIn

`src/modules/identity/presentation/pages/page-guards.ts` → **`requireSignedIn`** (line 8)

**The traveller:** If signed out: goes to `/account` and comes back after signing in.

**What runs:** Reads the Better Auth session from the request headers; redirects with `?next=` when there's no account.

**Called from:** [[A11 Checkout page › Checkout]] (pages.requireSignedIn()), [[B02 New plan page › NewPlan]] (pages.requireSignedIn()), [[B16 Plan page › Plan]] (pages.requireSignedIn()), [[B28 Driver & guides page › ServicesPage]] (pages.requireSignedIn()), [[B33 Trip checkout page › CheckoutPage]] (pages.requireSignedIn())

Back to the story: [[User Journey]]
