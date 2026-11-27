# Nightlife: plan

November 2026. **Built**, except where "Still open" says otherwise. It builds
on [TRANSPORT.md](TRANSPORT.md): day car blocks plus a separate night car, and
no 24-hour car. The sections below record the design as built.

## Where it lives

| Part | Code |
| --- | --- |
| Times to 30:00, `clockLabel`, `lagosInstant` | `src/modules/catalogue/domain/schedule.ts`, `localTime` in `trips/domain/planner.ts` |
| Night-before overlap, night car, late return | `assess()` in `trips/domain/planner.ts` |
| Timeline to 06:00, "ends after midnight" edit | `planner-timeline.tsx`, `planner.tsx` |
| Today view keeps the night out until 06:00 | `pocket.tsx` |
| Closes after midnight, night visit allowed | admin listing form; `nightReviewIssue` in `catalogue/domain/catalogue.ts` |
| Night car hours, price, start, late-return time | Admin → Transport & guides |
| Demo club listing | `src/data/nightlife.demo.json` (run `npm run db:seed:demo`) |
| Cart confirmation | `booking-panel.tsx` |

## Still open

- The cart confirmation isn't stored on the cart line yet.
- The night travel times reuse off-peak times until there is data.
- The planner-output contract in the handoff only allows times up to 23:59,
  so night items are exempt from it (they're only ever kept from the
  traveller's plan, never generated).

## Why nightlife doesn't work today

A night out like Saturday 22:00 to Sunday 03:00 is rejected at every layer:

| Layer | What stops it | Where |
| --- | --- | --- |
| Times | `localTime` only allows 00:00–23:59, and an end before the start is rejected ("End time must be after start time on the same day") | `itemSchema` and `assess()` in `src/modules/trips/domain/planner.ts` |
| Listings | Opening hours are a same-day `opensAt`–`closesAt`; nothing can be open past midnight | `availabilityLocal` in the catalogue |
| Car | A window past 24:00 fails with "vehicle coverage cannot extend beyond the service day" | `assess()` |
| Planner view | The timeline stops at midnight (`end = 1440`) | `src/components/planner-timeline.tsx` |
| Today view | At 01:00 "today" is already Sunday, so Saturday's night out disappears | `lagosToday()` in `src/components/pocket.tsx` |
| Catalogue | No demo listing runs past 23:00 | demo data |

## The fix

### 1. Count a night as part of the day it started (the core change)

Transit timetables solve this by letting times run past 24:00 within a
**service day**. A night out on Saturday is stored as:

```
localDate: 2026-12-26   startTime: 22:00   endTime: 27:00   (= Sun 03:00)
```

- Times can go up to `30:00` (06:00 the next morning). The service day runs
  06:00 to 06:00.
- Existing code keeps working: `minutes("27:00")` is 1620, and comparing
  `"27:00" > "22:00"` as text still gives the right answer.
- Screens show `27:00` as "03:00 (Sun)". Travellers never see 27:00.
- New check: Sunday can't start before Saturday's night ends. Today only
  overlaps on the same date are checked.
- The today view treats 00:00–05:59 as the previous day, so the night out
  stays visible until the morning.

This avoids storing a second date on every item, which would touch every
schedule comparison in the planner.

### 2. Let listings open past midnight

- `closesAt` can go past `24:00` too, e.g. a club open `22:00`–`28:00`.
- Start times, the booking panel and the planner then need no special
  handling, because they already work in minutes.
- Add one or two labelled demo listings, e.g. a club night in VI from 22:00
  to 04:00, so the journey can be shown and tested.
- Following the framework, a nightlife listing must have passed the
  night-time security check and carry its **night visit allowed** condition.
  Without it, the listing isn't published.

### 3. Add the night car block

- New `services.nightWindows[date] = { startTime }`, kept separate from
  `vehicleWindows`. A day and a night are then two blocks and two drivers.
- A fixed 6-hour block that can start between 20:00 and 24:00 and may end as
  late as 30:00 (06:00). Price: a demo night rate until partners set one.
- Items that start at 20:00 or later (`nightFrom`, a setting) go to the night
  block. Earlier items go to the day block. Each block is checked separately
  for pickup, drop-off and travel time.
- Add a **night** travel time to the area table (22:00–05:00). Until there
  is data, use the off-peak time.

### 4. Safety when travellers make their own way back

On an "own way" day, an activity ending at or after the late-return time
(e.g. 22:00, a setting) needs one of these:

- a night car block, or
- the traveller ticking **"I'll arrange my own way back"** for that activity.
  Stored as `services.ownWayBack: itemId[]`.

Checkout is blocked until one of the two is in place, using a
`LATE_RETURN` blocker.

### 5. The cart (booking one activity on its own)

A club night booked from the cart has no trip and no car, the same as
GetYourGuide. The booking panel shows "You'll arrange your own way there and
back", and the traveller confirms it before booking anything ending after the
late-return time.

## Build order

1. Service-day times, validation, the timeline to 06:00, labels and the today
   view, with tests.
2. Listings open past midnight, plus demo club listings.
3. The night block and night travel time.
4. The own-way-back confirmation in the planner and the cart.

Step 1 is the risky part: every schedule comparison has to accept times past
24:00. The rest builds on it.

## To decide (business)

- The night block's length (6 hours?) and price.
- When the night block starts (20:00?) and the late-return time (22:00?).
- Whether the night driver must be a different person from the day driver.
- Which real venues pass the framework's night-time review.
