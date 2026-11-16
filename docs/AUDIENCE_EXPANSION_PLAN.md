# Audience expansion: user journey and navigation plan

Status: **proposal for review.** No application code has changed. Dated
2026-11-16, branch `kemi-agent`.

## Sprint focus

This sprint is about **user journeys and UI navigation**, not booking
functionality. The goal is that each audience can click through its journey
end to end in the preview, on mobile first, with every screen showing the right
primary action and the right information. Each screen should make clear
whether an action saves, plans or buys.

In scope:

- New navigation, homepage, destination page, Explore filters, activity
  booking panel, cart, checkout review, ready-made trips list and detail, and
  the links between them and the existing Kemi and planner flows.
- Every screen built against **demo data**. Fixtures gain the sample fields the
  new screens need (age suitability, arrival mode, confirmation mode, venue,
  sample packages), labelled as samples like today's listings.
- UI states: empty, populated, long names, a line that is unavailable or needs
  partner confirmation, mobile and desktop.

Out of scope for this sprint (see §7):

- Real availability, holds, orders, payment, partner confirmation and refunds.
  The pay button stays disabled with the existing "nothing is booked or
  charged" notice.
- Multicity data beyond Lagos.

How this was checked: by reading the code and data, plus an HTTP check of the
running preview at `http://127.0.0.1:3000/` (it returns the "Lagos, your way"
headline). No browser screenshots were taken for this audit.

---

## 1. Current journeys and navigation

### 1.1 Navigation today

| Element | File | Today |
| --- | --- | --- |
| Header nav | `src/components/site-chrome.tsx` | Explore · Plan with Kemi · My trips · Account (or "Sign in"), plus a Bucket icon with a count. A hamburger menu on mobile |
| Brand | `site-chrome.tsx` `BrandMark`, `src/app/layout.tsx` metadata | **Ọ̀nà**, with the tagline "Lagos, your way" |
| Footer | `src/app/layout.tsx` | Explore · Plan with Kemi · My trips · Photo credits |
| Preview banner | `site-chrome.tsx` | "Sample experiences and prices. Nothing here is booked or charged." |

The navigation is organised around **planning a Lagos stay**. There is no
entry for buying a single activity, no cart, no ready-made trips and no
destination choice.

### 1.2 Journeys today

| Journey | Path through the app | Where it stops or misleads |
| --- | --- | --- |
| Discover | `/` → `/explore` → card → overlay or `/experiences/[slug]` | Fine for browsing. The date chip reads **trip dates** (`src/hooks/use-trip-dates.ts`), not "when do you want to go" |
| Save | Bookmark on card, overlay or detail → Bucket (`src/components/bucket.tsx`) | Works. Wording is clear ("Saving isn't booking") |
| Book one activity | Detail page | **Dead end.** The detail page only offers "Add to bucket" and "Plan my trip" (`src/app/experiences/[slug]/page.tsx`). There is no date, session, guests or buy action |
| Book several activities | none | No cart exists |
| Ready-made trip | none | No package pages exist |
| Custom plan | `/plan/new?mode=chat\|form` (sign-in required) → `/trips/[id]/plan` → `/services` → `/trips/[id]/checkout` | Works as a planning journey. Its checkout requires an accommodation address and a vehicle on every activity day (`src/modules/trips/domain/planner.ts:319–345`), so it cannot serve a resident's one-off outing |
| Add to trip | Overlay "Add to itinerary", only inside the planner (`src/components/experience-overlay.tsx`) | Not available from Explore or the detail page |

### 1.3 Screens and components to reuse

| Reuse | File | Use in the new journeys |
| --- | --- | --- |
| Experience card and grid | `src/components/catalogue-browser.tsx` (`ExperienceCard`) | Explore, home sections, destination page |
| Category chips, search | `catalogue-browser.tsx` | Explore filter row |
| Events strip and date logic | `src/components/whats-on.tsx`, `src/modules/catalogue/domain/events.ts` | "This weekend" on home and the destination page |
| Detail layout | `src/app/experiences/[slug]/page.tsx` | Keep the content column; replace the aside with the booking panel |
| Overlay dialog | `src/components/experience-overlay.tsx` | Same three actions as the detail page |
| Bucket button, nav and tray | `src/components/bucket.tsx` | The model for the Cart icon and cart tray |
| Intake (Kemi and form) | `src/components/intake.tsx` | Unchanged; gains a "seeded from package" entry |
| Planner and checkout styling | `src/components/planner*.tsx`, `src/components/checkout.tsx`, `src/components/trip-cost.tsx` | Price lines, checkout layout and blocker notices for the cart and checkout review |
| Tokens and styles | `src/app/tokens.css`, `globals.css`, `overlays.css` | All new screens |

### 1.4 Hard-coded assumptions the screens must stop making

- "Lagos" is written into home copy, detail "Area: …, Lagos", listing stories
  (`src/modules/catalogue/domain/experience-content.ts`) and page metadata.
- Group size is always shown as "adults"; every listing is `minAge: 18`.
- "Meeting point shared once booked" and "Free cancellation up to 48 hours" are
  the same fixed text on every listing.
- The home page promises "A driver comes with every activity day". That is true
  only for the planned-trip path.
- The checkout says "Payment confirms every activity, driver and guide at
  once" (`checkout.tsx`). That is wrong once items are booked separately.

---

## 2. Proposed navigation

### 2.1 Principles

1. **Organise by what people want to do.** Find something to do, take a
   ready-made trip, or get a plan built. Do not organise by audience; anyone
   can take any path.
2. **Destination and date come first and persist.** The user picks them once
   and every screen respects them.
3. **Three verbs, never mixed.**

| Verb | Control | What happens | Badge |
| --- | --- | --- | --- |
| **Save** | Bookmark icon, "Save" | The idea goes to the Bucket. No date needed | Bucket count |
| **Add to cart** | Primary button (after choosing date and guests) | A dated selection to buy | Cart count |
| **Add to trip** | Secondary, under "More" on mobile | Placed on a day in one of the user's plans | none |

After each action, a toast confirms what happened and links to the right
place: "Saved to Bucket · View", "Added to cart · View cart", "Added to Lagos
weekend, Sat 21 Nov · Open plan".

### 2.2 Header

```
Desktop
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fastlife   Things to do  Ready-made trips  Plan with Kemi  My plans          │
│                                        [📍 Lagos ▾]  [🔖 3]  [🛒 2]  [Account] │
└──────────────────────────────────────────────────────────────────────────────┘

Mobile (390px)
┌──────────────────────────────────┐
│ Fastlife      [📍Lagos▾] [🔖3][🛒2][☰] │
└──────────────────────────────────┘
 ☰ opens: Things to do · Ready-made trips · Plan with Kemi · My plans
          · Bookings (later) · Account
```

- **Things to do** goes to `/explore`, renamed from "Explore".
- **Ready-made trips** goes to `/packages`. It is new.
- **Plan with Kemi** goes to `/plan/new?mode=chat`, unchanged.
- **My plans** goes to `/trips`. It was "My trips"; it is renamed so it does not
  clash with "Ready-made trips". The URL is unchanged.
- **Destination chip:** a sheet listing destinations. Only Lagos is selectable
  this sprint; there is no "coming soon" list of cities without inventory. The
  choice is kept in the URL (`?city=lagos`) and in browser storage.
- **Bucket and Cart icons:** these are separate, with different icons and
  labels for screen readers.

### 2.3 Mobile bottom bar (option for review, D3)

```
┌────────┬──────────────┬────────────┬────────┬────────┐
│  Home  │ Things to do │ Trips      │  Kemi  │  Cart  │
└────────┴──────────────┴────────────┴────────┴────────┘
```

A persistent bottom bar makes the three paths and the cart reachable with a
thumb. The cost is screen height on activity pages, where the booking bar also
sits at the bottom. The recommendation is to **keep the hamburger and add a
sticky booking bar on activity and package pages only**.

### 2.4 Footer

Columns for **Discover** (Things to do, Ready-made trips, destinations),
**Plan** (Plan with Kemi, My plans), **Help** (how booking works, contact) and
**Preview** (photo credits, sample notice).

---

## 3. Journeys

### 3.1 Map

```
                      ┌────────────────────── Home ──────────────────────┐
                      │ destination + date → "Explore experiences"        │
                      └──┬──────────────┬────────────────┬───────────────┘
                         ▼              ▼                ▼
                  Things to do   Ready-made trips   Plan with Kemi
                   (Explore)        (/packages)      (/plan/new)
                         │              │                │
                         ▼              ▼                ▼
                 Activity detail  Package detail    Profile → Planner
                  │   │    │        │        │              │
            Save ◄┘   │    └► Add   │  "Build my own" ──────┘
          (Bucket)    │     to trip │                       │
                      ▼        │    ▼                       ▼
                    Cart ◄─────┘  Checkout review ◄── "Book these" (later)
                      │
                      ▼
               Checkout review  (pay disabled in preview)
```

### 3.2 Journey A: resident, family outing this Saturday

Home → **This weekend** or Explore with `date=Sat` and **Good for kids** →
activity → choose **Sat 21 Nov · 10:00 · 2 adults, 2 children (6, 9)** →
**Book now** → checkout review.

- No trip, profile or accommodation is asked for at any point.
- A pickup address appears **only** for listings marked as needing pickup.
- The arrival line reads "Get there yourself · Venue: …, Lekki" for
  self-arrival listings.

### 3.3 Journey B: diaspora visitor, two activities on different dates

Explore → beach day → **Sat 21 Nov, 2 adults → Add to cart** → toast → food tour
→ **Thu 26 Nov, 2 adults → Add to cart** → **Cart**.

The cart shows two independent lines, each with its own date, guests, price,
confirmation chip ("Instant confirmation" / "Partner confirms within 24 h"),
meeting point and cancellation summary, then one total. Checkout review repeats
both lines and explains that each is a separate booking. An optional link,
"Need help getting around?", goes to Plan with Kemi.

### 3.4 Journey C: traveller compares a package with a custom plan

Home → **Multi-day getaways** or nav **Ready-made trips** → package. The package
page shows route, nights, departures, **operator**, an **inclusions matrix**
(accommodation, flights, ground transport, guide, meals: included / arranged by
operator / not included) and **Fastlife support for this trip**.

From there, the traveller either chooses a departure (**Check dates →
travellers → Book**) or **Build my own version instead**. That opens Kemi
seeded with the package's cities, length and interests; the traveller lands in
the existing intake, then the planner.

### 3.5 Journey D: save, plan or buy

From one activity:

- **Save**: the bookmark fills. Toast: "Saved to Bucket. Saving doesn't hold a
  date."
- **Add to trip**: a sheet lists the user's plans (or "Start a new plan"),
  then a day. Toast: "Added to *Lagos weekend*, Sat 21 Nov · Open plan".
- **Add to cart**: needs a date and guests first. Toast: "Added to cart ·
  View cart".

The Bucket, the cart and the plan each say what they are in their empty
states.

---

## 4. Screen specifications

Each screen lists its **primary action**, the **essential information**, and
its **states**. Wireframes are for 390px mobile.

### 4.1 Home `/`

```
┌──────────────────────────────────┐
│ [photo hero]                     │
│ Things to do in Nigeria          │
│ ┌──────────────┐┌──────────────┐ │
│ │📍 Lagos     ▾││📅 Any date  ▾│ │
│ └──────────────┘└──────────────┘ │
│ [ Explore experiences  → ]       │  ← primary
│ Ready-made trips · Plan with Kemi│  ← text links
├──────────────────────────────────┤
│ This weekend            See all →│
│ [card][card][card] ⇢ (scroll)    │
├──────────────────────────────────┤
│ Family outings          See all →│
│ [card][card][card] ⇢             │
├──────────────────────────────────┤
│ Multi-day getaways      See all →│
│ [package][package] ⇢             │
├──────────────────────────────────┤
│ Browse by category (tiles)       │
├──────────────────────────────────┤
│ Want a plan built for you?       │
│ [K] Plan with Kemi →             │
├──────────────────────────────────┤
│ Save · Add to trip · Add to cart │
│ what each one means (strip)      │
└──────────────────────────────────┘
```

- **Primary action:** Explore experiences, carrying the chosen city and date.
- **Date chips:** Any date · Today · This weekend · Pick a date.
- **Sections:** each hides when its sample data is empty. "This weekend" uses
  the events date logic plus session dates. "Family outings" uses the new sample
  `familySuitable` field. "Multi-day getaways" uses sample packages.
- **Moved off home:** the three-step itinerary explainer and the "driver on
  every activity day" section move to the Plan with Kemi landing (the intake
  intro).

### 4.2 Destination page `/destinations/lagos`

- **Hero:** "Lagos, *your way.*"
- **Content:** the same sections as home, scoped to Lagos, plus an "Areas" row
  (Lekki, VI, Mainland) that links to Explore filtered by area.
- **Primary action:** Explore Lagos experiences.

### 4.3 Things to do `/explore?city=lagos&date=2026-11-21`

```
┌──────────────────────────────────┐
│ Things to do in Lagos            │
│ 📅 Sat 21 Nov  ✕   [⚙ Filters 2] │
│ (All)(Events)(Food)(Beaches) ⇢    │  ← wraps on desktop
│ 12 experiences                   │
│ ┌──────────────────────────────┐ │
│ │ [photo 4:3]              [🔖]│ │
│ │ Waterfront afternoon         │ │
│ │ Lekki · 3 h · Ages 5+        │ │
│ │ ₦15,000 per adult            │ │
│ │ (Instant confirmation)        │ │  ← only when the listing says so
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- **Filters sheet:** date, Good for kids, price range, duration, getting there
  (I'll make my own way / pickup available), area. Each control shows a selected
  state with `aria-pressed`.
- **Date behaviour:** a date filters to listings that run that day, using the
  existing weekday, opening-hour and session rules, and shows the session times
  on the card. It says "Runs Sat 21 Nov", **never "available"**, because
  availability is not real in this sprint.
- **Card action:** Save only. Booking starts on the detail page.
- **States:** no date (cards show their weekly pattern), no results ("Nothing
  on Sat 21 Nov with these filters" with "Clear filters"), and long titles.

### 4.4 Activity detail `/experiences/[slug]` (and the overlay)

```
┌──────────────────────────────────┐
│ ← Things to do                   │
│ [photo]                          │
│ Food · Lekki · Partner: [name]   │
│ Home-style cooking workshop      │
│ 3 h · Ages 12+ · Up to 8         │
│ Instant confirmation (sample)    │
├──────────────────────────────────┤
│ What's included / not included   │
│ Where: venue name, area          │
│ Getting there: Make your own way │
│   or pickup from Lekki/VI (+₦)   │
│ Good to know · Cancellation      │
├──────────────────────────────────┤
│ ▔▔▔▔ sticky booking bar ▔▔▔▔     │
│ From ₦20,000 / adult [Choose date]│
└──────────────────────────────────┘

Choose date → bottom sheet
┌──────────────────────────────────┐
│ Date      [calendar: run days]   │
│ Session   (10:00) (14:00)        │
│ Guests    Adults [-2+]           │
│           Children [-1+] ages ▾  │
│ Pickup    ○ Make my own way      │  ← only if pickup is offered
│           ○ Pick me up: [address]│
│ ─────────────────────────────── │
│ 2 adults × ₦20,000    ₦40,000    │
│ 1 child × ₦10,000     ₦10,000    │
│ [  Book now  ]  [Add to cart]    │
│ 🔖 Save   ＋ Add to trip          │
└──────────────────────────────────┘
```

- **Primary action:** Book now (adds to cart and opens checkout review).
  Secondary: Add to cart. Then Save and Add to trip.
- **Essential information:** operator, venue or meeting area, getting there,
  age suitability, confirmation mode, inclusions, and cancellation summary. All
  of it comes from sample fields and is labelled as sample.
- **Desktop:** the same panel as a sticky side card in place of today's
  `detail-aside`.
- **Overlay:** the same three actions. In the planner, "Add to itinerary"
  becomes "Add to this trip".

### 4.5 Cart `/cart`

```
┌──────────────────────────────────┐
│ Your cart · 2 items              │
│ Each item is booked separately,  │
│ with its own date and terms.     │
│ ┌──────────────────────────────┐ │
│ │[img] Waterfront afternoon    │ │
│ │ Sat 21 Nov · 14:00 · 2A 2C   │ │
│ │ Make your own way · Lekki    │ │
│ │ Instant confirmation         │ │
│ │ Free cancellation to 19 Nov  │ │
│ │ ₦45,000        Edit · Remove │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │[img] Hosted suya evening     │ │
│ │ Thu 26 Nov · 19:00 · 2A      │ │
│ │ ⚠ Partner confirms in 24 h   │ │
│ │ ...                          │ │
│ └──────────────────────────────┘ │
│ Subtotal ₦65,000 · Fee ₦6,500    │
│ Total ₦71,500                    │
│ [ Review and checkout ]          │
│ Save for later moves to Bucket   │
└──────────────────────────────────┘
```

- **Primary action:** Review and checkout.
- **Line states to design and build** (driven by sample flags):
  - Normal.
  - **Needs partner confirmation**: an amber chip with the timeframe.
  - **No longer runs on this date**: the line shows a message plus *Choose
    another date · Save to Bucket · Remove*, and is excluded from the total.
    The other lines are unaffected.
  - Price changed: shows the old and new price.
- **Empty state:** "Your cart is empty. Things you choose to book appear here.
  Saved ideas live in your Bucket." Links to Things to do and the Bucket.
- **Storage this sprint:** browser storage, like the Bucket's local cache. No
  server cart.

### 4.6 Checkout review `/checkout`

- **Order of sections:**
  1. Contact details.
  2. Per-line details: a pickup address only for pickup lines, and child ages.
  3. Per-line terms in one list with a single acknowledgement.
  4. "What happens after you pay": each line shows its own expected status
     ("Confirmed straight away" or "Partner confirms by Wed 18 Nov").
  5. The pay button, disabled with the preview notice.
- **Sign-in:** asked here, not earlier (D4).
- **Removed:** the trip-level "Payment confirms every activity, driver and
  guide at once" message.

### 4.7 Ready-made trips `/packages` and `/packages/[slug]`

```
List card                          Detail
┌──────────────────────────┐       ┌──────────────────────────────────┐
│ [photo]                  │       │ [photo]                          │
│ Lagos → Abeokuta → Ibadan│       │ Southwest heritage, 4 days       │
│ 4 days · 3 nights        │       │ Run by [operator] · Verified     │
│ Next: 4 Dec · Operator X │       │ From ₦280,000 per person (twin)  │
│ From ₦280,000 pp (twin)  │       ├──────────────────────────────────┤
└──────────────────────────┘       │ Route: Day 1 Lagos … Day 4 …     │
                                   │ Included                         │
                                   │  Accommodation   ✓ Included      │
                                   │  Flights         — Not included  │
                                   │  Ground transport✓ Included      │
                                   │  Guide           ✓ Included      │
                                   │  Meals           ~ Breakfasts    │
                                   │ Fastlife support for this trip   │
                                   │  Pre-arrival check · Changes ·   │
                                   │  Early exit help (sample terms)  │
                                   │ Booking terms                    │
                                   ├──────────────────────────────────┤
                                   │ [Check dates]  Build my own →    │
                                   └──────────────────────────────────┘
```

- **Primary action:** Check dates (a departure sheet, then travellers, then Add
  to cart).
- **Secondary:** Build my own version. It opens `/plan/new?mode=chat&from=package:<slug>`
  and the intake shows "Starting from *Southwest heritage*".
- **Sample data:** two or three fictional packages in a new fixture, labelled
  like the current demo listings.

### 4.8 Plan with Kemi and My plans

- **Landing:** Plan with Kemi keeps the existing intake. The itinerary
  explainer and driver/guide content moved from home go above the chat.
- **My plans (`/trips`):** renamed. The empty state explains the difference
  between plans and bookings.
- **Planner:** its activity library already shows the Bucket. It gains a "From
  your cart" tab so the user can see dated selections there. The planner's own
  checkout is unchanged this sprint.

---

## 5. Sprint delivery plan (UI only)

| # | Work | Main files | Depends on |
| --- | --- | --- | --- |
| 1 | **Sample data fields:** age policy, arrival mode, venue, confirmation mode, cancellation summary, operator on listings; a new `packages.demo.json` with 2–3 packages | `tourism-v1-handoff/data/experiences.demo.json`, `src/data/events.demo.json`, new `src/data/packages.demo.json`, `src/modules/catalogue/domain/experience.ts` | D1, D2 |
| 2 | **Navigation:** header labels and order, destination chip, Cart icon, menu, footer | `src/components/site-chrome.tsx`, `src/app/layout.tsx` | D1, D3 |
| 3 | **Home and destination page** | `src/app/page.tsx`, new `src/app/destinations/[city]/page.tsx` | 1 |
| 4 | **Explore:** browse date (separate from trip dates), Good for kids, getting there, filters sheet | `src/components/catalogue-browser.tsx`, `src/hooks/use-trip-dates.ts` | 1 |
| 5 | **Activity booking panel and action set:** detail and overlay; Add to trip sheet | `src/app/experiences/[slug]/page.tsx`, `src/components/experience-overlay.tsx`, `src/components/bucket.tsx` | 1 |
| 6 | **Cart:** browser-stored, with line states and empty state | new `src/hooks/use-cart.ts`, `src/components/cart.tsx`, `src/app/cart/page.tsx` | 5 |
| 7 | **Checkout review** for the cart | new `src/app/checkout/page.tsx`; reuses `checkout.tsx` styles | 6 |
| 8 | **Ready-made trips** list and detail, plus "Build my own" seeding | new `src/app/packages/**`, `src/components/intake.tsx` | 1 |
| 9 | **Copy pass:** remove "Lagos" hard-coding from shared copy, fix the misleading checkout and home claims, and add toasts for the three verbs | `experience-content.ts`, `checkout.tsx`, `page.tsx` | 2–8 |
| 10 | **Visual and journey QA:** journeys A–D at 390, 768 and 1440 px; keyboard; last item reachable in the cart, filter sheet and booking sheet (per `skills/ui-formatting/SKILL.md`); behaviour tests for the journey transitions | `tests/`, `scripts/check-journey.mjs` | all |

Items 1–2 unblock everything. Items 3, 4, 5 and 8 can run in parallel; 6 and 7
follow 5.

---

## 6. Decisions needed (UI and journey)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | **Brand in the UI.** Fastlife or Ọ̀nà in the header and metadata | Fastlife as the platform brand; "Lagos, your way" kept on the Lagos destination page |
| D2 | **Sample content.** Which demo listings become "family" or "pickup" examples, and the 2–3 sample packages (routes, operators) | Fictional and labelled, as today; one package per pattern: road trip, flights included, and lodging only |
| D3 | **Mobile navigation.** Hamburger plus booking bar, or a bottom tab bar | Hamburger plus a sticky booking bar on activity and package pages |
| D4 | **When to ask for sign-in.** Today planning requires it up front | Browsing, saving and cart work as a guest; sign-in at checkout and when creating a plan |
| D5 | **Naming.** "My plans" for `/trips`, "Things to do" for Explore, "Ready-made trips" for packages | As proposed |
| D6 | **"Book now" vs "Add to cart" as the primary action** on the activity page | Book now primary, Add to cart secondary |

Business decisions (launch inventory, partner confirmation rules, transport
options, package support commitments) do not block this sprint. The screens
show sample values in the places where those answers will appear.

---

## 7. Later: what the journeys will need from the backend

These notes are for the following sprint, so the screens are built with the
right slots.

- **Catalogue:** typed listing fields matching the sample ones above;
  destinations with inventory; filtering and pagination by city, date and
  family suitability (today `GET /api/v1/experiences` returns everything).
- **Availability:** per date, session and guest mix. Only then may the UI say
  "Available" or show remaining places.
- **Orders and payment:** one payment, one order and **one booking per cart
  line**, each with its own status, terms and refund path. The flow follows
  `tourism-v1-handoff/docs/03_PRICING_AND_BOOKING.md`, with Paystack assumed.
- **Partner operations:** a confirmation queue with an SLA, decline and refund
  handling, and package departure manifests.
- **Planner:** booked items as locked blocks, and self-arrival days that don't
  require an accommodation address or vehicle (`planner.ts:319–345`).
- **Business decisions:** confirmed launch inventory, partner confirmation and
  payment rules, transport options, package support commitments, merchant of
  record for flights and lodging, and cancellation and fee refunds.

---

## 8. Acceptance scenarios (clickable in the preview this sprint)

| Scenario | Journey | Passes when |
| --- | --- | --- |
| A resident finds a Saturday family outing and reaches checkout without an itinerary or accommodation address | A | Home → Explore (Sat, Good for kids) → activity → Book now → checkout review, with no profile, plan or address step for a self-arrival listing |
| A diaspora visitor selects two activities on different dates and sees the combined total, each item's terms and both confirmation statuses | B | The cart and checkout review show two lines with separate dates, terms and confirmation chips, and one total |
| A traveller compares a package with a custom plan and sees the operator and travel and lodging inclusions | C | Package detail shows the operator and inclusions matrix; "Build my own version" opens a seeded Kemi intake |
| A user can save, add to trip, or add to cart and understands each | D | All three actions exist on the activity page and overlay, each with distinct labels, toasts and destinations |
