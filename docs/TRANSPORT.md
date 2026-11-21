# Transport: how it works today

November 2026. This describes the code as it is. Rates and travel times are
fictional demo values.

## The short version

The app has **three unconnected ways** of handling transport, one per way of
booking:

1. **Building your own trip (the planner):** you get a car and driver for the
   whole day, booked in a 4-hour or 8-hour block.
2. **Booking one activity (activity page or cart):** some activities offer a
   pickup for a flat fee. Most don't, and then you make your own way.
3. **Ready-made trips:** transport is just a line in "what's included".

None of them knows about the others. Nothing chooses transport *for* the
traveller yet. The planner only checks that what the traveller picked works.

## 1. Planner: car and driver by the day

### What the traveller chooses

1. **In trip details:** "We'll use your car and driver" or "We'll make our own
   way". This is stored as `profile.transport` (`DEDICATED` or `OWN`) in
   `src/modules/trips/domain/profile.ts`. If it's never set, it counts as
   `DEDICATED`.
2. **On the planner's services panel, for each day with activities:** when the
   car starts (**Vehicle from**) and for how long (**Reserved hours**: 4 or 8).
   This is stored as `services.vehicleWindows`, one `{ startTime, hours }` per
   date, in `src/modules/trips/domain/planner.ts`.

The **Car and driver** card at the top of the services panel
(`src/components/planner.tsx:727`) looks like a checkbox, but it's always
ticked and greyed out. It only tells the traveller a car is included; it can't
be changed there. The real choice is item 1, in trip details.

### Why the car is booked in 4 or 8 hour blocks

The rule comes from the V1 handoff spec
(`tourism-v1-handoff/docs/03_PRICING_AND_BOOKING.md`, "Transport V1 proposed
policy"):

- **The car is yours for the day.** It isn't a taxi called for each leg. One
  vehicle and driver are reserved for the traveller. The driver waits during
  each activity and between activities, then takes everyone back. The spec
  says waiting time between a morning and an evening activity still counts as
  reserved time.
- **The block is the driver's time, not distance.** V1 deliberately doesn't
  invent distance or traffic-based fares ("does not calculate invented
  real-time distance fares"). Selling a fixed number of hours means we can
  quote one known price before the day happens.
- **A half-day or a full day.** 4 hours covers a single outing near the
  accommodation. 8 hours covers a full day. A fixed menu of two blocks is
  simple to price, show and book with a partner.
- **Nothing longer than 8 hours.** The spec says longer days are
  "unavailable until an explicit overtime/evening product is configured", and
  we must "never silently round a 10-hour day down to eight hours". An
  unsupported day is blocked rather than undercharged.

Demo prices (`tourism-v1-handoff/data/pricing.demo.json`): 4 hours ₦30,000,
8 hours ₦45,000 per vehicle. One vehicle seats 4 people.

*Our reading, not stated in the spec:* half-day and full-day hire is also how
drivers are commonly booked in Lagos, so these blocks should map onto partner
contracts. Confirm this with transport partners before launch.

### How the app checks a day

For each day that has at least one booked activity (`assess()` in
`planner.ts`), the app checks:

| Check | In words | Error if it fails |
| --- | --- | --- |
| Base | We know where the traveller is staying | `MISSING_BASE` |
| Booking | The day has a car start time and a 4 or 8 hour block | `MISSING_WINDOW` |
| Pickup | The car starts early enough to reach the first activity in rush-hour traffic | `SERVICE_WINDOW` |
| Drop-off | The block lasts long enough to get everyone back after the last activity | `SERVICE_WINDOW` |
| Between stops | There's enough time to drive from one activity to the next | `TRANSIT` |

Travel times come from a fixed table between the three areas (Lekki, VI,
Mainland), with an off-peak and a peak figure (`travelMatrixMinutes` in
`pricing.demo.json`). Peak means 07:00–10:00 and 16:00–20:00. For the pickup
the app always uses the slower of the two figures, so the car is never
planned too late.

**What the car costs per day:** number of cars (people ÷ 4, rounded up) × the
block price. A ₦10,000 surcharge per car is added if the day goes between
areas.

A day with only personal blocks (free time, meals) gets no car. With
"own way", none of this applies and there's no transport charge.

### Worked example

Two adults staying in Lekki. Day plan:

- 10:00–12:00 gallery in VI
- 14:00–16:00 beach in Lekki

| Step | Working |
| --- | --- |
| Pickup | Lekki → VI is 45 min off-peak, 75 min peak; use 75. The car must start by **08:45**. |
| Between stops | Leaving VI at 12:00 (off-peak) for Lekki takes 45 min; 2 hours are free. OK. |
| Drop-off | Leaving the beach at 16:00 (peak) for the Lekki base takes 45 min, back at **16:45**. |
| Block | 08:45 → 16:45 is exactly 8 hours, so it needs the **8-hour block**. A 4-hour block would end at 12:45. |
| Price | 1 car × ₦45,000 + ₦10,000 surcharge (Lekki and VI) = **₦55,000**. |

### Where it falls short

When an activity is added to a day with no car yet, the app fills in
**08:00 for 8 hours** regardless of the plan (the add handler in
`planner.tsx`). In the example above that car would end at 16:00. That is 45
minutes before everyone gets back, so the day is blocked until the traveller
moves the start to 08:45 by hand.

**The missing algorithm** is to set the car from the plan itself:

1. Start = first activity start − the slower travel time from the base,
   rounded down to the quarter hour.
2. End = last activity end + travel time back to the base.
3. Use 4 hours if end − start ≤ 4 hours, 8 hours if ≤ 8 hours. Otherwise
   don't pick one; tell the traveller the day is too long for one car.
4. Repeat whenever activities on that day are added, moved or removed, unless
   the traveller has set the car times themselves.

## 2. Single activity or cart: pickup per listing

### Where it's set

Each listing has an **arrival mode**:

- `SELF`: make your own way
- `PICKUP_OPTIONAL`: make your own way, or pay a flat fee for pickup
- `PICKUP_REQUIRED`: pickup is part of the booking

It's set in `src/modules/catalogue/domain/listing-details.ts`, together with
`pickupRateMinor`. **These are hard-coded sample values in code, not in the
catalogue schema**, so staff can't change them in admin. A listing without a
sample value is `SELF`.

Only four listings offer pickup: the market, beach and street carnival
(optional), and the history tour (required). That is why the conservation
walk shows no transport choice.

When booked, each cart line stores `pickup` (yes/no) and `pickupAddress`
(`cartLineSchema` in `src/modules/bookings/domain/cart.ts`). The pickup price
is the same flat fee whatever the area, distance or group size.

### What the traveller sees

The **Getting there** section of the booking panel
(`src/components/booking-panel.tsx`):

- `SELF`: a line of text ("Make your own way · venue") and no choice.
- `PICKUP_OPTIONAL`: two radio buttons, and an address field if pickup is
  chosen.
- `PICKUP_REQUIRED`: a line of text and an address field.

## 3. Ready-made trips

Ground transport is listed as included in `src/data/packages.demo.json`. It
has no times, car booking or separate price.

## Rides as a cheaper option (built, November 2026)

Where it lives:

- The choice: `profile.transport = "RIDES"`, picked in trip details as
  "Rides to and from each activity".
- The rating: `returnRide` on each listing
  (`src/modules/catalogue/domain/return-ride.ts`). Staff set it in admin as
  **Ride back**. Unrated listings count as `PRE_BOOK`.
- The rules: `rideLegs()`, `dayCarQuote()` and `rideRules` in
  `src/modules/trips/domain/planner.ts`. A ride costs a demo ₦6,000 plus ₦100
  per off-peak travel minute, per car. A ride back at 20:00 or later is always
  booked ahead, and the free wait is 15 minutes. These settings live in code
  because the handoff pricing file has never been edited.
- What travellers see: each ride on the services panel, its price, whether
  it's booked or "when you're ready", and the price of a car for the day for
  comparison.

The design notes below are what it was built from.

A car for the whole day is expensive for a traveller doing one or two things.
Add a third choice next to "own way" and "car for the day":

| Option | What they get | Priced by |
| --- | --- | --- |
| Make my own way | Nothing from us | — |
| **Rides** | A pre-booked car for each leg: hotel → activity, activity → activity, activity → hotel | Each leg, by area pair (the travel table we already have) |
| Car for the day | One car and driver, 4 or 8 hours | Block |

The planner should compare the two and say so, e.g. "3 rides ₦X · a 4-hour
car ₦30,000 is cheaper".

### The risk: getting back

Going out is easy: the ride is booked for a known time. Coming back is the
risk, because the end time can move (a flexible visit, an event that runs
late) and cars may be scarce. Hailing a ride on the spot is probably fine in
Lekki, VI or Ikoyi in the daytime. It gets hard in predictable cases: late at
night, in heavy rain, when a concert or carnival lets out, and at remote or
boat-access places. We have no data on how often this happens, so don't
assume it's rare. Design so the traveller is never left relying on luck.

### How the framework covers it

The onboarding framework already asks this question for every listing:

- **Proximity & Logistics:** driver access, pickup and drop-off point,
  traffic sensitivity.
- **Accessibility:** "ability to navigate independently".
- **Emergency readiness:** "how quickly a traveller can be collected" and
  "what backup transport … is available".
- **Final approval test:** "CAN we get them there and back?"
- **ORANGE rating:** offer the listing only when, for example, "platform
  driver and guide are mandatory".

The framework produces the answer during onboarding, but the app has nowhere
to store it. Record it on each listing as a **return-ride rating** set by the
reviewer:

| Rating | Meaning | Return ride offered |
| --- | --- | --- |
| `EASY` | Cars are easy to find there during opening hours | Booked time, or "message us when you're done" |
| `PRE_BOOK` | Cars are unreliable there or at that hour | Booked time only, chosen when booking |
| `DRIVER_REQUIRED` | The framework's ORANGE case | Car for the day only; rides not offered |

Platform-wide rules on top of the rating:

- Any return after a set hour (e.g. 20:00), or from a dated event, counts as
  `PRE_BOOK`.
- A booked return comes with a free waiting time (e.g. 15 minutes), then
  is charged per extra block. All three numbers are settings, like the guide
  notice.
- Operations keeps a backup car or partner for each area. The framework
  already asks for this.

### Still to decide (business)

- The price of a ride for each area pair, and whether it's per car or per
  person.
- Whether rides are our own drivers, a partner fleet, or a hailing app we book
  on the traveller's behalf.
- The late-hour cutoff and the waiting allowance.

## Problems to solve

1. **Two models that don't know about each other.** A traveller with a trip
   car who also books a cart activity with pickup pays for transport twice.
2. **The car isn't set from the plan.** The fixed 08:00 / 8-hour default
   blocks many valid days (see the worked example).
3. **Pickup isn't in the catalogue schema.** Staff can't set it, and a
   traveller can't ask for our transport on a `SELF` listing.
4. **No option for long days.** A day over 8 hours can't be booked at all
   until an overtime or evening product exists.
