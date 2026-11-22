---
step: A07
journey: Book one activity
layer: Domain
file: src/modules/catalogue/domain/schedule.ts
function: "startTimesOn"
line: 87
tags: [user-journey]
---
# A07 · schedule › startTimesOn

`src/modules/catalogue/domain/schedule.ts` → **`startTimesOn`** (line 87)

**The traveller:** Sees the start times for the chosen day.

**What runs:** Fixed sessions, the opening time of a full day, or hourly starts that leave room for the shortest visit. With `now`, drops starts inside the booking notice and adds a late drop-in time.

**Called from:** [[A06 Booking panel › Panel]] (startTimesOn(e, date, now))

Back to the story: [[User Journey]]
