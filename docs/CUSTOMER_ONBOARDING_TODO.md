# Customer onboarding, stay preference and fulfilment (to do)

Planning note, 2026-11-26. Nothing here is built yet. It covers what a
traveller tells us when they ask Fastlife to plan for them, the airport pickup
for travellers arriving from abroad, and what they see between paying and the
first day of the trip.

Builds on what exists:

- Trip profile: `accommodationBy` (`SELF` | `FASTLIFE`), free-text
  `accommodation` and `zoneId` (`src/modules/trips/domain/profile.ts`), asked in
  the plan form (`src/components/intake.tsx`).
- Trip checkout, one payment, with cars and guides as service requests matched
  by staff after payment (migration `0011`, staff queue in `0806c41`).
- Admin-configurable transport prices (`src/modules/trips/domain/transport-settings.ts`,
  admin → Transport settings).
- Booking confirmation by partner or staff (`AWAITING_PARTNER` → `CONFIRMED`)
  and buyer emails after payment.
- The day view (`/trips/[id]/today`, `src/components/pocket.tsx`) with "Next up".

---

## 1. Stay preference when Fastlife plans for them

When the traveller chooses "Fastlife books my stay", don't ask for a hotel
name first. Ask in this order:

1. **Preferred area** (required): the existing zone choice (Lekki, Victoria
   Island, Ikoyi, …).
2. **Type of stay** (required): hotel, serviced apartment / short-let,
   guesthouse, resort. Optional: budget per night.
3. **Do you have a place in mind?** One input that does three things:
   - **Search.** As they type, show the closest matches from our hotel list
     (filtered to the chosen area and type first, then everywhere).
   - **Their own name.** If nothing matches, or they insist on what they typed,
     offer "Use ‘<what they typed>’" and keep it as a free-text preference,
     marked unverified for staff.
   - **A link.** If they paste a Booking.com, Airbnb or hotel website link,
     recognise it and show it as "Booking.com listing", "Airbnb listing" or
     "Hotel website".
4. **No preference:** "We’ll send you stay recommendations within 48 hours."

### Matching ("closest match")

- Case- and accent-insensitive; ignore punctuation and words like "hotel",
  "the", "lagos".
- Build the pattern from the typed words with every regex character escaped
  (never run the raw input as a regex). Rank: name starts with the input →
  every word found → some words found → small typos (edit distance ≤ 2 on a
  word).
- Show at most 8 results; the "Use ‘…’" option is always last.

### Links

- Accept `https://` only, up to 500 characters. Recognise hosts
  `booking.com`, `airbnb.*`; anything else is "Hotel website".
- Store the link as text. Don't fetch it from the server in the first version
  (no previews: avoids server-side request forgery and scraping terms).
  Staff open it themselves.

### Data

Add to the trip profile (replacing free-text `accommodation` for
`FASTLIFE` stays; `SELF` keeps its address field):

```ts
stay: {
  area: ZoneId;
  type: "HOTEL" | "APARTMENT" | "GUESTHOUSE" | "RESORT";
  budgetPerNightMinor?: number;
  choice:
    | { kind: "LISTED"; hotelId: string }
    | { kind: "NAMED"; name: string }            // typed, unverified
    | { kind: "LINK"; url: string; source: "BOOKING" | "AIRBNB" | "WEBSITE" }
    | { kind: "RECOMMEND" };                      // we reply within 48 h
}
```

### Staff side

- A **stay requests** queue next to the driver/guide matching queue: area,
  type, budget, choice, dates, guests, and the 48-hour deadline for
  `RECOMMEND` (overdue ones flagged).
- Staff send one or more **stay offers** (price includes our markup, per the
  2026-11-24 decision). The traveller **approves and pays** in the app as a
  second payment on the same order. This is step 3 of trip checkout
  (accommodation offers), already planned.

### To do

- [ ] Hotel list: decide the source (staff-entered first, see open decisions),
      table `hotels` (name, aliases, area, type, address, active)
- [ ] `matchHotels(query, area, type)` in trips domain + unit tests (typos,
      punctuation, regex characters, ranking)
- [ ] `stay` on the profile + migration of existing `FASTLIFE` profiles
- [ ] Plan form and Kemi chat: area → type → search/name/link → "recommend"
- [ ] Link recognition + validation tests
- [ ] Staff stay-request queue with 48 h deadline
- [x] Stay offers: send, approve, pay (second checkout on the order).
      Built 2026-11-26: migration `0014_stay_offers.sql`, staff "Stays"
      section in the admin panel (up to 3 open offers per paid trip, price
      includes markup, "held until" time, withdraw), and "Approve and pay" on
      the booking page. Paying books the chosen offer on the same order and
      declines the rest; two stays paid at once book one and send the other
      to review. Not yet: emails when an offer is sent, the stay request
      queue, and offers for trips that aren't paid yet.

---

## 2. Arrival from abroad and airport pickup

### Onboarding questions

Ask early in "plan my trip", after dates:

1. **Are you travelling from outside Nigeria?** yes / no
2. If yes: **Do you want us to pick you up at the airport?** yes / no
3. If yes: arrival airport (Lagos MMIA first), flight number, landing date
   and time, number of travellers and bags. Flight details can be added
   later, until a deadline before arrival (like the pickup-address reminder,
   `pickupAddressNoticeHours`).

### Price

- Flat **₦40,000** per pickup for now, set by admin in Transport settings:
  new field `airportPickupMinor` (default `4_000_000` kobo) in
  `transportSettingsSchema`, with an admin input and audit like the other
  transport prices.
- The price is copied onto the checkout line at payment, so a later change
  doesn't alter paid trips.

### Checkout

- The pickup is a line in the single trip payment: a new service kind
  `AIRPORT_PICKUP` next to `CAR`, `NIGHT_CAR`, `FULL_DAY_GUIDE`,
  `ACTIVITY_GUIDE`, priced from `airportPickupMinor`.
- After payment it becomes a service request in the staff matching queue,
  with the flight details. It follows the same rule as other services:
  matched at least `serviceNoticeHours` (48 h) before landing, or refunded.

### To do

- [ ] Profile fields: `fromAbroad`, `airportPickup` (airport, flight,
      landing time, travellers, bags)
- [ ] Onboarding questions in the plan form and Kemi chat
- [ ] `airportPickupMinor` in transport settings (schema, admin form, default
      ₦40,000, tests)
- [ ] Service kind `AIRPORT_PICKUP`: checkout line, matching queue row
      showing flight details
- [ ] Reminder when flight details are missing close to arrival

---

## 3. After checkout: the fulfilment stage

After paying, the trip page shows a **fulfilment tracker** until everything
is settled. One row per thing we're arranging, each with its own status and
an email when it changes (the buyer email from `ab43d19` is the start):

| Row                   | Statuses the traveller sees                                    | Source                                                    |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Payment               | Received                                                       | checkout `PAID`                                           |
| Airport pickup        | Finding your driver → Driver matched (name, car, phone) → Done | service request `AIRPORT_PICKUP`                          |
| Stay                  | Finding options → **Hotel ready: approve and pay** → Booked    | stay request / offer (section 1)                          |
| Cars and guides       | Finding → Matched (per day)                                    | service requests `CAR`, `NIGHT_CAR`, `*_GUIDE`            |
| Activities and events | Waiting for the operator → Confirmed                           | bookings `AWAITING_PARTNER` → `CONFIRMED` (partner/staff) |

- Rows that need the traveller to act ("approve and pay") go first, with a
  button.
- Anything unmatched or declined shows the refund it triggers.

### To do

- [ ] Fulfilment view on the trip/order page, built from order, bookings,
      service requests and stay offers
- [ ] Emails per status change (driver matched, hotel ready to approve,
      event confirmed), using the notifier
- [ ] "Approve and pay" for stay offers from the tracker

---

## 4. From fulfilment to the day view

Once the trip starts (or when everything is settled), the trip opens on the
**day view**. Arrival day starts with what we arranged:

1. **Airport pickup**: landing time, flight, driver name, car and phone.
2. **Check in** at the booked stay (address, check-in time).
3. Then the planned items as today, with "Next up" moving through the day.

Later days follow the existing day view: activities, events, car and guide
windows in time order.

### To do

- [ ] Day view adds arranged items to the plan: airport pickup (from the
      matched service request) and stay check-in (from the booked offer)
- [ ] Before the trip: day view shows the fulfilment tracker instead, with
      "Your trip starts in N days"
- [ ] Tests: arrival day order (pickup → check-in → first activity), trips
      without pickup, pickup not yet matched

---

## Order of work

1. Airport pickup question, `airportPickupMinor` setting and `AIRPORT_PICKUP`
   service (reuses the matching queue; smallest step with visible value).
2. Fulfilment tracker on the order page.
3. Stay preference (area → type → search/name/link → recommend) and the staff
   stay-request queue.
4. Stay offers: approve and pay.
5. Day view: arrival-day items.

## Open decisions

- **Hotel list source:** staff-entered list first (recommended), or a places
  API later? Search only works as well as this list.
- **Budget per night:** ask, or leave to staff?
- **Airports:** Lagos only at first, or Abuja too? One price for all?
- **Return trip:** offer a departure drop-off at the same price?
- **Airbnb / short-lets:** do we book these for travellers, or only hotels we
  can contract with?
- **48-hour promise:** business hours or calendar hours, and who is alerted
  when it's close?
