# Admin panel

`/admin` is the staff workspace. Only accounts with the `ADMIN` role can open it
(`npm run demo:grant-admin -- email@example.test`, with the dev server stopped).
Every save is version-checked and writes an audit event that names the fields
that changed.

## What a listing editor can change

Values save to the listing's catalogue record. Browse, the experience overlay,
the detail page, the planner and the cart all read that record, so a published
change shows up on the next page load.

| Section             | Fields                                                                                                                                                                 | Where travellers see it                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Basics              | Name, category, area, kind (main / light / full day), tags from the fixed list                                                                                         | Cards, filters, planner slotting                                       |
| Story               | Teaser, summary, why go                                                                                                                                                | Cards, search, overlay, detail page                                    |
| Pricing & party     | Price basis, adult rate, child rate, min/max party, minimum age, capacity unit, capacity per slot, host included                                                       | Prices, cart totals, booking guest limits, family filter               |
| Schedule            | Days, opening hours (closing may be after midnight), shortest/longest visit, booking notice, flexible or fixed, sessions (time, length, capacity, dates), closed dates | Date pickers, "runs on" hints, planner placement                       |
| Logistics & terms   | Operator, venue, getting there, pickup add-on price, night visit allowed, confirmation mode and partner reply time, free cancellation                                  | Booking panel, cart; late listings need night visit allowed to publish |
| Access & inclusions | Walking intensity, wheelchair access, included, not included                                                                                                           | "Good to know" and inclusion lists                                     |
| Media & event       | Photo (licensed set), video URL, dated event type, what is always included, what may happen but is never promised                                                      | Hero image and credit, video, What's on, event dates                   |
| Publishing          | What is still missing before publishing; other statuses                                                                                                                | Only `DEMO_PUBLISHED` listings are visible                             |

The editor opens with what travellers see today. For demo listings that means
the sample copy and terms in `experience-content.ts` and `listing-details.ts`.
The first save stores those values on the record, and from then on the stored
values win over the samples. A listing with stored details uses its own minimum
age rather than the sample one.

The browser validates the edit with the same Zod schema as the API
(`catalogueEditSchema`) before sending it. Problems are listed above the save
bar. The API also accepts the older core payload: any section that is left out
keeps its stored value.

## Publishing

Only staff add activities and trips, so a staff member's publish is the
approval. There is no separate verify step: **Publish** (or **Save &
publish**) in the save bar saves the editor, ticks all five review checks as
that staff member's approval, and sets `DEMO_PUBLISHED`. The audit event
records who did it. **Unpublish** sets `PAUSED`, which hides a listing from new
selections but keeps it in trips that already include it.

Publishing is refused, with the reasons listed, until the listing is ready:

- the price is above ₦0
- the story summary has been written (not the "being prepared" placeholder)
- the venue or meeting point is real, not the "(sample venue)" fallback
- at least one thing is included

The server applies the same checks (`listingReadiness` in
`catalogue/domain/catalogue.ts`), so the API can't skip them.

## Tags

Tags come from one fixed list in `catalogue/domain/tags.ts`, grouped as who it
suits, style, theme and occasion. Staff pick them from the **Add a tag**
dropdown and remove them by clicking the chip. The API refuses any tag that
isn't in the list, so the same idea is never spelled two ways. To add a tag,
add it to that file with its label. Activities and ready-made trips share the
list.

## Ready-made trips

**Ready-made trips** are multi-day getaways run by partner operators, for
example three days in Obudu. Create one from its title, then fill in:

| Section         | Fields                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| Basics          | Title, summary, operator, about the operator, starting city, tags                      |
| Route           | One entry per day: place and plan. Days can be added, removed and reordered; nights    |
| Departures      | Date and seats (open, few left, full). Past dates are hidden from travellers           |
| Pricing         | Per person sharing or per person, price, single room supplement                        |
| What's included | Accommodation, flights, ground transport, guide, meals, entry fees: status and details |
| Terms & publish | Booking terms (one per line), what's missing before publishing, a preview of the card  |

The web address (`/packages/<slug>`) is made from the title when the trip is
created, with a number added if it is taken. It never changes after that,
because carts refer to it.

A trip can be published once it has a summary, an operator, at least two days
with a place and plan for each, a price above ₦0, an upcoming departure that
isn't full, a status for every inclusion and at least one booking term.
Published trips appear under Ready-made trips, on the home page and on the
starting city's page, and can be added to the cart.

Trips are stored in the `packages` table (migration 0007). `npm run
db:seed:demo` adds the three sample trips from `src/data/packages.demo.json`
without overwriting edits. Until the migration runs, travellers see the sample
trips and staff saves explain which commands to run.

A listing that runs past midnight can't be saved as verified or published
until **Night visit allowed** is ticked, recording the framework's night-time
security review.

## Transport & guides

Below the listings, **Transport & guides** edits the rules the planner prices
with: car-for-the-day blocks (hours and price), seats per car, cross-area
surcharge, the night car (hours, price, start time), the late-return time, the
guide notice and the pickup address reminder (hours before the first pickup). Saves are version-checked and audited
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
5. **Fastlife support promises** shown on every trip, in `packages.ts`.
6. **Photos**: staff pick from the licensed set in
   `public/assets/photos/credits.json`. Uploading needs storage and a licence
   check.
7. **Partners**: operators are free text on each listing. Partner records
   (contacts, payout details, onboarding framework checks) should become their
   own module, linked from listings.
8. **Operations views**: an audit log viewer, staff roles, and bookings and
   orders once that module exists.
