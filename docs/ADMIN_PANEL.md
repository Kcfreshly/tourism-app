# Admin panel

`/admin` is the staff workspace. Only accounts with the `ADMIN` role can open it
(`npm run demo:grant-admin -- email@example.test`, with the dev server stopped).
Every save is version-checked and writes an audit event that names the fields
that changed.

## Roles

| Role          | Can                                                                         |
| ------------- | --------------------------------------------------------------------------- |
| `ADMIN`       | Create, edit, publish and unpublish; read history; restore deleted listings |
| `SUPER_ADMIN` | Everything an admin can, plus delete listings                               |

Grant with the dev server stopped:
`npm run demo:grant-admin -- email@example.test` for an admin, or add
`--super` for a super admin. The API enforces the roles; the admin panel only
shows **Delete listing** to super admins.

Partners are not a role: any account can apply at `/partner`, and staff verify
the business under **Partners** in `/admin`. The same section is the queue for
activities and trips partners submit. See [PARTNER_PORTAL.md](PARTNER_PORTAL.md).

## Audit trail, deleting and restoring

`audit_events` is the backup. Every create, save, delete and restore of a
listing adds an event holding a **full snapshot** of the listing after the
change, with who did it and when. Migration 0008 also records a starting
snapshot of every existing listing, and the seed script does the same for new
seeds.

The table is append-only, enforced by the database rather than the app:

- `UPDATE`, `DELETE` and `TRUNCATE` on it are refused by triggers.
- `DROP TABLE`, dropping its triggers or functions, and `ALTER TABLE` (for
  example to disable a trigger) are refused by event triggers.
- A developer can lift this for one console session only, with
  `SET app.allow_audit_ddl = 'on';`. The app never sets it, so no admin action
  can change the trail.

On a hosted Postgres, also give the app's database role only `INSERT` and
`SELECT` on `audit_events`, and keep table ownership with a separate
developer role.

**Deleting.** A super admin opens the listing, goes to **Publishing**, adds an
optional reason and clicks **Delete listing**. The listing leaves the
catalogue straight away. A `CATALOGUE_DELETED` event keeps its last snapshot
and the reason.

**Restoring.** Any admin opens **Recently deleted** under the listings and
clicks **Restore**. The listing comes back exactly as it was when deleted
(same id, address, status and content, with its photos), at the next version
number. This adds a `CATALOGUE_RESTORED` event. A restore is refused if
another listing has taken its address in the meantime. `npm run db:seed:demo`
never re-creates a deleted demo listing, so recovery always goes through
Restore.

**History.** The **History** tab of each listing lists its audit events
(created, saved with the changed fields, deleted with the reason, restored),
read-only for every admin.

## Photos

In **Photos & event**, staff upload JPEG, PNG or WebP photos, up to 5 MB each
and 12 per listing. Each photo gets a description for screen readers. The
first photo is the **primary** one; **Make primary** moves any photo to the
front, and the arrows reorder the rest.

- Cards and search results show the primary photo.
- The full experience page shows every photo in a grid, primary first and
  largest.
- The quick-view overlay shows one photo at a time with previous and next
  buttons.

A listing with no uploaded photos keeps using the chosen licensed inspiration
photo.

Uploads go to `POST /api/v1/admin/media` (admins only, 60 a minute). The
server checks the file type from its bytes, never its name, and refuses
anything else, including SVG. Photos are stored in the `media` table and served
from `/api/v1/media/<id>` with long caching, `nosniff` and a locked-down
content security policy. Identical files are stored once. Photo rows are never
deleted, so restored listings keep their photos.

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
| Photos & event      | Uploaded photos with a primary, licensed inspiration photo, video URL, dated event type, what is always included, what may happen but is never promised                | Hero image and credit, video, What's on, event dates                   |
| Publishing          | What is still missing before publishing; other statuses; delete (super admin)                                                                                          | Only `DEMO_PUBLISHED` listings are visible                             |

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
