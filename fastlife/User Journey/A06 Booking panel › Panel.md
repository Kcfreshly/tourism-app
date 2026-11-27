---
step: A06
journey: Book one activity
layer: Component
file: src/components/booking-panel.tsx
function: "Panel"
line: 124
tags: [user-journey]
---
# A06 · Booking panel › Panel

`src/components/booking-panel.tsx` → **`Panel`** (line 124)

**The traveller:** Picks a date, a start time and guests; confirms how they'll get back if it ends late.

**What runs:** Client component. Offers only start times still bookable today, prices the line as it changes, and lists what's missing (`problems`) before booking is allowed.

**Called from:** [[A05 Experience page › Detail]] (renders, startOpen)

**Next:**
- [[A07 schedule › startTimesOn]] — startTimesOn(e, date, now)
- [[A08 bookings cart › experienceLinePrice]] — experienceLinePrice()
- [[A09 Booking panel › bookNow]] — Book now

Back to the story: [[User Journey]]
