# Transport: how it works

November 2026. Rates and travel times are fictional demo values; staff can
change the rates in the admin panel.

## The short version

| Journey | Transport |
| --- | --- |
| Building a trip (the planner) | Each day is **car and driver** for a block of hours, or **our own way**. A **night car** can be added for a night out. |
| Booking one activity (activity page or cart) | Pickup where the listing offers it; otherwise the traveller makes their own way. Late finishes ask them to confirm how they'll get back. |
| Ready-made trips | Transport is listed under "what's included". |

Rides (a booked car per leg) were tried and removed. A waiting driver avoids
the risk of no car being available for the trip back, and day hire is how
drivers are contracted. The decision is recorded in the history of this file.

## Planner

### What the traveller chooses

- **The trip default**, in trip details: car and driver, or our own way
  (`profile.transport`: `DEDICATED` or `OWN`). Trips saved with the old
  `RIDES` choice load as car trips.
- **Each day**, on the services panel: the same switch, stored as an
  override in `services.dayTransport`.
- **A car day**: when the car starts and how many hours
  (`services.vehicleWindows`). The lengths and prices come from the
  transport settings (demo: 4, 8, 10 and 12 hours).
- **A night car**, when the day has activities starting from the night start
  time (demo 20:00): a separate driver for a fixed block (demo 6 hours) that
  can run past midnight to 06:00 (`services.nightWindows`).
- **On an own-way day**, anything ending at or after the late-return time
  (demo 22:00) needs a night car or a tick: "I'll arrange our own way back"
  (`services.ownWayBack`).

### How the car is set

The planner fits the car to the plan (`fitCar` in
`src/modules/trips/domain/planner.ts`):

1. Pickup = first activity start − the slower (rush-hour) travel time from
   the base, rounded down to the quarter hour.
2. Return = last activity end + travel time back to the base.
3. The shortest configured block that covers pickup to return.

Whenever activities change, a car that is missing or no longer covers the day
is refitted. A car that still works is left as the traveller set it. **Fit to
my plan** refits on request. If no block is long enough, the panel suggests a
night car for the evening or making their own way for part of the day.

A night car starts no earlier than the night start time and covers only the
activities starting from then; the day car covers the rest.

### What is checked (`assess()`)

| Check | Error |
| --- | --- |
| The area is known when any car is booked (it times and prices pickups) | `MISSING_BASE` |
| A car day with daytime activities has a car window | `MISSING_WINDOW` |
| The block length is one staff offer | `SERVICE_WINDOW` |
| Pickup in time for the first activity, and the trip back fits | `SERVICE_WINDOW` |
| No car runs past 06:00; a night car starts from the night start time | `SERVICE_WINDOW` |
| Travel time between activities | `TRANSIT` |
| Late finishes on own-way days are covered | `LATE_RETURN` |

**Pickup address.** In trip details the traveller says who books the stay:
**I'll book my own stay** or **Book it for me** (`profile.accommodationBy`:
`SELF` or `FASTLIFE`). When Fastlife books it, no address is asked for; we
only need the area they'd like to stay in. When they book their own, a
missing address never blocks booking. Instead a `PICKUP_ADDRESS` warning
(`pickupReminder` in `planner.ts`) asks for it by a deadline: the trip's first
car pickup, less the **pickup address reminder** hours in the transport
settings (demo: 12). After the deadline it says "Add your pickup address now".
The reminder shows in the planner (with a form to add it), at checkout, on
the today view and on My plans, and links to trip details opened at the
address field. Email or push reminders need a notifications service and are
not built.

**Price**: cars (people ÷ seats per car, rounded up) × the block price, plus a
cross-area surcharge per car when a car's activities span areas. Day and night
cars are priced separately.

### Worked example

Two adults in Lekki: makers visit in VI 10:00–12:00, conservation walk in
Lekki 14:00–16:00.

- Pickup 10:00 − 75 min (Lekki → VI at rush hour) = **08:45**.
- Back from Lekki at 16:00 (peak, 45 min) = **16:45**.
- 8 hours covers it: **₦45,000 + ₦10,000** cross-area = **₦55,000**.

Add a club night in VI 22:00–02:00 with a night car: pickup 20:45, back in
Lekki 02:45 (night travel uses off-peak times), **₦40,000 + ₦10,000**.

## Transport settings (admin)

**Staff workspace → Transport & guides** edits, with a version check and an
audit event:

- car blocks (hours and price per car), seats per car, cross-area surcharge
- night car hours, price and start time, and the late-return time
- guide notice (hours)

Stored in the `transport_settings` table (migration 0006). Until a row is
saved, the defaults in `src/modules/trips/domain/transport-settings.ts` apply.
The planner receives the settings with the workspace, so its estimates match
the server's. Guide rates and the travel-time table are still in
`tourism-v1-handoff/data/pricing.demo.json`.

## Single activity or cart

Each listing's arrival mode (`SELF`, `PICKUP_OPTIONAL`, `PICKUP_REQUIRED`)
is set in the admin listing form. A pickup is one-way. If the visit ends at
or after the late-return time, the booking panel asks the traveller to
confirm they'll arrange their own way back before booking. This confirmation
is not yet stored on the cart line.

## Still open

- The cart and the planner don't know about each other: a trip car and a cart
  pickup on the same day are both charged.
- Real rates, driver hours for 10 and 12 hour days, and whether the night
  driver must differ from the day driver.
- Airport transfers (a rate exists in the pricing file; no product yet).
