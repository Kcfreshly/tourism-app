# Admin panel

`/admin` is the staff workspace. Only accounts with the `ADMIN` role can open it
(`npm run demo:grant-admin -- email@example.test`, with the dev server stopped).
Every save is version-checked and writes an audit event that names the fields
that changed.

## What a listing editor can change

Values save to the listing's catalogue record. Browse, the experience overlay,
the detail page, the planner and the cart all read that record, so a published
change shows up on the next page load.

| Section             | Fields                                                                                                                                 | Where travellers see it                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Basics              | Name, category, area, kind (main / light / full day), tags                                                                             | Cards, filters, planner slotting                         |
| Story               | Teaser, summary, why go                                                                                                                | Cards, search, overlay, detail page                      |
| Pricing & party     | Price basis, adult rate, child rate, min/max party, minimum age, capacity unit, capacity per slot, host included                       | Prices, cart totals, booking guest limits, family filter |
| Schedule            | Days, opening hours (closing may be after midnight), shortest/longest visit, booking notice, flexible or fixed, sessions (time, length, capacity, dates), closed dates | Date pickers, "runs on" hints, planner placement         |
| Logistics & terms   | Operator, venue, getting there, pickup add-on price, night visit allowed, confirmation mode and partner reply time, free cancellation            | Booking panel, cart; late listings need night visit allowed to publish |
| Access & inclusions | Walking intensity, wheelchair access, included, not included                                                                           | "Good to know" and inclusion lists                       |
| Media & event       | Photo (licensed set), video URL, dated event type, what is always included, what may happen but is never promised                      | Hero image and credit, video, What's on, event dates     |
| Review & publish    | Status, five-point review checklist                                                                                                    | Only `DEMO_PUBLISHED` listings are visible               |

The editor opens with what travellers see today. For demo listings that means
the sample copy and terms in `experience-content.ts` and `listing-details.ts`.
The first save stores those values on the record, and from then on the stored
values win over the samples. A listing with stored details uses its own minimum
age rather than the sample one.

The browser validates the edit with the same Zod schema as the API
(`catalogueEditSchema`) before sending it. Problems are listed above the save
bar. The API also accepts the older core payload: any section that is left out
keeps its stored value.

Publishing still follows the review workflow: tick all five checks, save as
`DEMO_VERIFIED`, then save as `DEMO_PUBLISHED`. `PAUSED` hides a listing from
new selections but keeps it in trips that already include it.

A listing that runs past midnight can't be saved as verified or published
until **Night visit allowed** is ticked, recording the framework's night-time
security review.

## Transport & guides

Below the listings, **Transport & guides** edits the rules the planner prices
with: car-for-the-day blocks (hours and price), seats per car, cross-area
surcharge, the night car (hours, price, start time), the late-return time and
the guide notice. Saves are version-checked and audited
(`TRANSPORT_SETTINGS_UPDATED`). It needs migration 0006 (`npm run db:migrate`
with the app stopped); until then the defaults apply and saving explains the
missing migration. See [TRANSPORT.md](TRANSPORT.md).

## Not editable yet

These values are still in code or fixture files. Each one needs a table and an
admin section of its own.

1. **Guide rates and travel times**: the activity and full-day guide rates and
   the area travel-time table in `tourism-v1-handoff/data/pricing.demo.json`.
2. **Booking defaults**: `flexibleMinStayMinutes`, price bands in
   `schedule.ts`, the default trip budget in `profile.ts`.
3. **Destinations and areas**: `catalogue/domain/destinations.ts`. Listing
   areas are fixed to Lekki, VI and Mainland until this moves to a table.
4. **Categories**: `tourism-v1-handoff/data/categories.json`.
5. **Ready-made trips**: `src/data/packages.demo.json` and the Fastlife support
   promises in `packages.ts`.
6. **Photos**: staff pick from the licensed set in
   `public/assets/photos/credits.json`. Uploading needs storage and a licence
   check.
7. **Partners**: operators are free text on each listing. Partner records
   (contacts, payout details, onboarding framework checks) should become their
   own module, linked from listings.
8. **Operations views**: an audit log viewer, staff roles, and bookings and
   orders once that module exists.
