---
step: A04
journey: Book one activity
layer: Component
file: src/components/experience-overlay.tsx
function: "ExperienceOverlay"
line: 68
tags: [user-journey]
---
# A04 · Experience overlay › ExperienceOverlay

`src/components/experience-overlay.tsx` → **`ExperienceOverlay`** (line 68)

**The traveller:** Reads the details in a dialog and taps **Book this experience**.

**What runs:** Client dialog (`ActivityDialog` inside). The button is a link to `/experiences/<slug>?book=1`, carrying the way back to Explore.

**Called from:** [[A03 Catalogue browser › CatalogueBrowser]] (opens card)

**Next:**
- [[A05 Experience page › Detail]] — link ?book=1

Back to the story: [[User Journey]]
