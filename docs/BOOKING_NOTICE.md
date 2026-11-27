# Minimum booking notice

November 2026.

## Rule

Each listing carries `offer.bookingCutoffHours`: the minimum notice its
operator (or we) need before a session starts.

- `0` means a traveller can book right up to the start time, including later
  the same day. A session that has already started cannot be booked.
- Any other value means the session must start at least that many hours after
  the booking. A daily event with 24 hours' notice cannot be booked for today.

There is no platform-wide cutoff. The planner checks each time slot against its
own listing (`assess` in `src/modules/trips/domain/planner.ts`).

## Where it is set

- Demo data: `tourism-v1-handoff/data/experiences.demo.json` and
  `src/data/events.demo.json`. Every listing is `0` except the hosted cooking
  class (`offer-cooking`), which is `24` as an example of a host needing notice.
- Staff: **Minimum booking notice (hours)** in the catalogue admin, 0–168.

The original 24 and 48-hour values were placeholders from the V1 handoff data,
not a business decision.

## What travellers see

- On a day that has passed: "This day has passed", with a link to change dates.
- A listing too late for the chosen day: "Too late to book for this day", or
  "Too late for this day: book at least N hours ahead" when it needs notice.
- A blocked slot: "This start time has already passed" or "This experience
  needs booking at least N hours before it starts".

## Existing databases

`npm run db:seed:demo` only inserts missing listings and never overwrites
edits, so a database seeded earlier keeps the old 24/48-hour values. Change them
in the catalogue admin, or update the stored records.
