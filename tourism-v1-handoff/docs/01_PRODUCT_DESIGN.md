# Product and interaction design

## 1. Product promise

Help a visitor plan, book and enjoy a personalised Nigerian stay through a coordinated itinerary, transport, optional local hosting and an AI companion. The customer buys an organised experience with a clear price and clear delivery responsibilities.

Primary user: a diaspora visitor or international traveller who wants local experiences and dependable coordination. Secondary users: a couple celebrating an occasion and a small private group. These are target hypotheses, not validated market segments.

The product has three connected surfaces: customer planning and checkout; the mobile pocket companion during the stay; staff operations. Guides and drivers receive assignments from staff in V1; a separate supplier app is outside scope.

## 2. Decisions and scope

### Confirmed from the discussion

- Two entry paths: conversational AI and a structured form.
- Collect preferences, occasion, dates, party, budget, accommodation and assistance needs; AI can ask useful contextual follow-ups.
- AI pre-populates an itinerary; customer chooses and edits activities and times.
- Desktop planner has a discoverable category/activity panel and a day/time schedule. Drag-and-drop is desired; accessible add/move controls must also exist.
- Personal jogging, rest, family visits and other custom blocks belong in the schedule, even when they generate no booking revenue.
- Automatic price calculation and immediate payment; not a delayed quotation service.
- Guide support or driver-led coordination; self-navigation is not the promoted primary offer.
- Airport welcome, transfer and connectivity assistance are optional service possibilities.
- Companion shows itinerary, driver and guide identity/photos, context and support.
- Lagos Life is available in V1: hosted local markets, neighbourhood experiences, suya and local social venues. It is optional within a varied stay, not the whole holiday.
- Default pace: two main activities and one optional light activity daily.
- Keep accommodation fixed by default; group experiences geographically.

### Proposed V1 defaults

Lagos only, 1–30-day trips, 1–8 adults, English, NGN checkout, 20–30 verified catalogue entries, one base address, responsive web/PWA-ready architecture. No hotel booking engine. Collect flight information only when an airport service is chosen. A customer can leave free days; do not force a purchase every day.

Assistance: `DRIVER_ONLY`, `ACTIVITY_GUIDE`, `FULL_DAY_GUIDE`. Transport is included for off-base booked experiences under all three. A selected-activity guide only covers eligible selected experiences. Full-day hosting covers the displayed service window, not 24-hour availability. Personal/free blocks may sit outside the supported schedule and must show this clearly.

### Later versions

Native iOS/Android, continuous location sharing, geofenced emergency notifications, automated security intelligence, live driver map, supplier marketplace onboarding, multi-city optimisation, hotel relocation suggestions, dynamic transport routing, multi-currency settlement and open-ended external booking agents.

## 3. Navigation and information architecture

Public: Home → Explore → Experience detail → Plan a trip. Planning: Intake → Planner → Services → Review & pay → Confirmation. Signed-in: My trips → Trip → Today / Plan / Bookings / Help. Staff: Overview / Trips / Catalogue / Availability / People / Incidents / Settings.

Let guests explore, chat and draft. Require sign-in before payment. Persist an anonymous draft server-side under an unguessable session token; merge on sign-in without losing edits. Never expose another user's draft via a guessed identifier.

Desktop: global header with brand, Explore, Plan a trip, My trips, profile. Mobile public pages use a compact header. Active-trip mobile surface uses four bottom navigation items: Today, Plan, Bookings, Help. Keep an always-accessible support action during the trip.

## 4. End-to-end example

A couple enters seven days, a fixed Lekki accommodation, interests in art, nature and Lagos Life, balanced pace and driver-only assistance. AI proposes a draft from eligible catalogue entries, keeping arrival light and free time visible. They move an art visit, add a family block and select a guided local evening. Each change produces a new server price and validation result. They choose an airport transfer, review inclusions and service windows, sign in and pay against a temporary capacity hold. The app confirms only after server-side payment verification. Staff assign the reserved service capacity to named personnel. The companion shows names when assigned and “Assignment pending — details due [time]” beforehand.

## 5. Screen specifications

### S01 Home — `/`

Purpose: understand the offer and begin planning. Desktop: generous hero with brand proposition, original placeholder artwork, two equal entry buttons and a short “How it works” row. Main heading: “Your Lagos stay, thoughtfully arranged.” Primary: “Plan with AI”; secondary: “Use the trip form.” Explain both lead to the same plan. Show eight category cards, a sample day and what transport/hosting means. Do not fabricate ratings, traveller counts or trust badges.

Mobile: stacked entry buttons above category cards; no carousel required. City selector lists Lagos as available; future cities are explicitly labelled coming soon and cannot produce checkout inventory.

### S02 Explore — `/explore?city=lagos`

Search, category chips, date, duration, price range, main/light/full-day and accessibility filters. Cards show image/placeholder, name, area, duration, price basis (“per adult” or “per group”), verification freshness and add button. “From” prices must have a real eligible variant behind them; transport inclusion must be explicit. With no matching results, show active filters, clear filters and alternative categories. Never silently relax mobility requirements.

Selecting a card opens S03; adding without a trip starts intake and preserves the selection. Catalogue entries that are researched but not approved must not appear as bookable products.

### S03 Experience detail — `/experiences/:slug`

Image gallery, category, area, main/light designation, duration range, description, inclusions/exclusions, route/meeting point, available slots, age restrictions, walking/intensity, accessibility detail, host requirement, cancellation terms and last verification date. Price panel shows participants, available date/time, line items and “Add to my plan.” An activity can include its own host; do not charge a second host for the same scope. Venue name, activity and purchasable offer are distinct data concepts.

No availability: display “Unavailable for these dates” and suggest eligible alternatives. Unknown accessibility: display “Not confirmed”; never turn unknown into accessible.

### S04 Intake — `/plan/new`

Entry switch: “Chat with the planner” / “Fill in the form.” Both read/write the same structured profile. Form sections: (1) city and dates; (2) party and accommodation; (3) interests, occasion and pace; (4) budget and support preferences. Trip budget explicitly says whether it includes accommodation/flights; default scope is platform services only. Ask budget per party or per person with an explicit toggle. Meals preferences include dietary restrictions, alcohol preference, crowds and walking comfort. Accommodation can initially be “Not decided”; require a confirmed address or approved service zone before reserving transport.

Chat asks at most two related questions per turn. Show collected fields in an editable summary, never just an opaque conversation. Avoid intrusive occasion questions; “Anything you’d like us to celebrate?” is optional. AI must not invent a name to greet the visitor. Continue is enabled once city, dates, party and interests are present. Generation screen shows progress, cancel and a retry path. Failure preserves the profile and allows manual planning.

Dates: end on/after start, 1–30 local calendar days. Party: 1–8 adults for initial live release; if family support is enabled later, collect child ages and enforce eligibility/child seats. Optional accessibility and dietary information should be minimised and only shared with relevant fulfilment partners.

### S05 Planner — `/trips/:id/plan`

Primary working screen. Desktop ≥1200px: left activity library 288px; flexible centre day schedule; right estimate panel 304px. At 768–1199px collapse pricing into a drawer and use a 240px library. Under 768px show one day at a time, scrollable day chips and an Add button opening a bottom sheet. Never squeeze all desktop columns onto a phone.

Library: search, eight category chips, main/light labels and duration. Centre: trip/date/party header, day selector, timeline, travel buffers, breaks and explicit empty slots. Offer list/calendar toggle. A 10-day trip uses day navigation, not ten narrow columns. Right panel: current total, grouped activity/transport/hosting/arrival fees, selected support level, outstanding issues and “Review services.”

Interactions: add to chosen day/time; drag to move; keyboard move via dialog; edit start and duration within offer limits; remove with Undo; add custom block; lock an item; regenerate unlocked items for this day; undo last AI proposal. AI changes display a diff before Apply. Dragging never automatically purchases anything. Cross-day moves rerun pricing and eligibility. Updates save with optimistic version checking; retain an unsaved indicator/retry if network fails. Failed server validation rolls back the move or retains a visibly invalid draft, never a silently incorrect total.

Timeline examples: 08:00 personal jog; 09:00 pickup; activity; travel; lunch; activity; return. Personal blocks are free text, zero-priced and private by default. They are not sold inventory and do not imply staff supervision. Allow unallocated free time and do not stretch an activity beyond its permitted duration merely to fill a gap.

Validation categories: overlap, closed/outside slot, insufficient transit, over budget, unavailable capacity, expired data, party mismatch, missing accommodation, missing support. Errors link to the relevant item. Hard blockers prevent checkout; budget and density can be warnings acknowledged by the customer. “Two main + one optional light” is a generation default, not a prohibition on an explicit customer edit. Full-day experiences block the main daytime period; no second main activity is auto-added. Arrival/departure days consider flight and buffer times.

Travel estimates: use a conservative configured zone/time-band matrix in V1, visibly labelled estimates. Unknown route blocks sellable transfer combinations until configured. Do not present invented live traffic. Keep mainland activities together where feasible and return to the same base. A late night pushes the next morning's recommendation later. Meal/downtime blocks can be custom and are not automatically charged reservations.

### S06 Services — `/trips/:id/services`

Cards compare driver only, selected-activity guide and full-day guide: coverage, service hours, vehicle limits, waiting, what is excluded. For full-day guide select covered days and display daily start/end; overtime requires a priced approval. For activity-guide choose eligible activities. Mandatory local hosts are included regardless of assistance preference.

Arrival optional controls: airport pickup, arrival welcome, connectivity assistance. Collect flight, terminal when known and contact method. SIM activation is “connectivity assistance” until an actual partner process is verified; do not promise pre-registered SIMs. Airport delay rules and waiting charges must be visible before checkout. Unavailable add-ons are disabled with a reason. Save and continue to review.

### S07 Review & pay — `/trips/:id/checkout`

Summary of days and party; immutable price breakdown preview; service inclusions; policies per service; customer contacts; consent; inventory hold countdown; payment provider handoff. Show NGN prominently and any provider charges only if configured. Do not hide fees until the final click. Promo codes, tips and split payments are out of scope.

Primary action “Pay ₦[total]”. Server revalidates and holds the entire itinerary bundle. If price changed, show old/new line items and require explicit acceptance. If capacity fails, identify the item and offer replacement; do not charge a partial trip. Double-click and retries return the same checkout attempt. Provider redirect “success” alone never renders confirmed payment.

States: validating → held → provider pending → verifying payment → confirmed. Failed payment supports retry while the hold remains valid. Expired hold requires fresh availability and price. If customer returns while verification is pending, show “We’re checking your payment” and a stable reference; never invite an immediate duplicate payment.

### S08 Confirmation — `/bookings/:id/confirmation`

Booking reference, payment verified status, reservation statuses, next actions, assignment timeline, selected arrival services and link to companion. Receipt is separate from entry tickets. Only render a scannable supplier ticket when a real ticket/reference exists; a decorative QR is not a valid admission credential. If payment cleared after capacity expired, show payment received / resolution in progress, not confirmed inventory.

### S09 My trips — `/trips`

Draft, upcoming, active and past cards. Resume draft, open companion, view bookings, request change/cancel. Empty state links to planning. Account contact details editable; updating contact does not change historical price snapshots.

### S10 Pocket Today — `/trips/:id/today`

At 390px: trip/date top bar, next pickup card, daily timeline, assigned contact cards, contextual local notes and persistent Help. Show time, pickup location and “Be ready by” guidance; guide/driver photo, verified internal identity label, vehicle plate/model where available and service hours. Never manufacture a verification badge from demo data. Tapping Call invokes a phone link only if a valid number exists; demo contacts are visibly inactive.

No assignment yet: pending state and expected assignment deadline. Changed schedule: show changed item and require acknowledgement for material changes; retain audit history. “Ready to leave” sends a request, not a promise the driver is present. Staff acknowledge it with an ETA. Rescheduling after payment is a change request with separate price/refund treatment.

Contextual assistance answers questions grounded in itinerary and approved venue notes. It must not claim to track the traveller without permission. V1 uses itinerary context, optional one-time location attachment to a support request and staff-authored service advisories; no automated nearby emergency promises.

### S11 Plan and bookings in pocket — `/trips/:id/itinerary`, `/bookings/:id`

View all days, booked services, confirmed inclusions, ticket links and cancellation rules. Downloadable or cached itinerary summary includes last-sync time. Cache only a minimal schedule the customer has opted to retain; do not cache payment secrets or unrestricted ticket credentials. Offline mode shows stale status clearly, supports reading cached schedule and ordinary phone links; sending requests requires connectivity and must not appear successful while offline. Sign-out clears local trip data.

### S12 Help — `/trips/:id/help`

“Contact trip support,” “Driver/guide issue,” “Change my plan,” and “Urgent help.” Show actual staffed support hours and response expectations from configuration. Support form includes category, description, relevant booking and optional location with a one-time consent action. Show submitted/acknowledged/resolved. No false guarantee of emergency dispatch or 24/7 monitoring. Emergency-service contacts must be locally verified before publication; omit unverified numbers. The UI can display “For immediate danger, contact local emergency services” plus a verified contact when configured.

### S13 Staff overview — `/admin`

Service-day view: arrivals, trips starting, unassigned services, expiring inventory, open incidents and payment exceptions. Prioritise actionable work over decorative charts. Filters by local date, area, service type and assigned operator. Show the oldest unresolved exception and deadline. Money metrics distinguish gross booking value, platform revenue and refunds.

### S14 Staff trip detail — `/admin/trips/:id`

Customer/party with access control, itinerary, immutable paid order, supplier reservations, payment/refund status, assignments, contact log, incident log and audit trail. Assignment action filters eligible available people and prevents overlapping work; changing person updates companion and notifies customer. Assigning a person cannot create capacity that was not reserved. Staff changes to paid itinerary require a change-order workflow; do not mutate the paid order silently.

### S15 Catalogue and inventory — `/admin/catalogue`, `/admin/availability`

Draft/researched/verified/published/paused states. Required fields and evidence links; pricing variants; service zones; slots and capacity; blackout dates; policies; photos/licensing; accessibility; verification expiry. Publish gate requires verified content, rates, capacity agreement and policies. Availability editor displays remaining/held/booked units per resource and local time. Pausing stops new sales; existing bookings become an explicit review queue rather than silently disappearing.

### S16 People, support and settings

People: drivers, guides, vehicles, checks/expiry, service areas, contact, photo and schedule. Incidents: owner, severity, status, timeline and associated trip. Settings: pricing versions, service hours, cancellation templates, support contacts, provider readiness and feature flags. Sensitive configuration changes require admin role and audit. Refunds require authorised role and reason.

## 6. Visual direction

Warm, editorial and calm. Ivory surfaces, deep forest green, restrained terracotta accents, ample whitespace and legible typography. Avoid generic neon AI aesthetics and oversized chat interfaces. The itinerary and next action should dominate. Use original category vectors supplied until licensed venue imagery is obtained; do not represent vectors as photos.

Use the CSS tokens. Typography: system UI font for controls; Georgia or similar system serif for display headings; no font download dependency. Max content width 1280px; page margins 24–48px desktop, 16px mobile. Spacing follows 4px scale. Cards 16px radius; controls min 44px touch target, primary buttons 48px high. Text contrast must meet WCAG AA. All information encoded by colour also needs text/icon. Respect reduced motion.

Components: AppShell, EntryChoice, TripProfileSummary, CategoryChip, ActivityCard, ExperienceDetails, DayPicker, Timeline, TravelBuffer, CustomBlock, ActivityEditDialog, PriceBreakdown, AssistanceCard, CapacityHoldBanner, PaymentState, AssignmentCard, TicketCard, SupportRequest, StatusBadge, ConfirmChangeDialog, AuditTimeline.

Each async component needs loading, empty, error, success and stale data states. Skeletons preserve layout. Inline errors have recovery actions and retain user input. Dialogs trap focus and restore it. Drag-and-drop has keyboard and button alternatives. Bottom-sheet content is scrollable and never hides its final action behind the keyboard.

## 7. Product measurements

Track entry path, intake completion, itinerary generation/apply, item edits, services selection, checkout started, capacity conflict, payment verified, assignment published, support request and completed trip. Use event IDs, trip IDs, pseudonymous user IDs and consent-aware analytics; exclude raw chat, addresses, phone numbers and sensitive preferences. Distinguish conversion from planning to payment and contribution after variable costs. No unsupported numeric conversion targets in the UI.

## 8. Open decisions register

Before live sale confirm: brand/domain; first city/service zones; party/child policy; sellable partners and price agreements; transport pricing and guide hours; payment processor eligibility; cancellation/refund terms; support staffing and escalation; connectivity partnership; data retention; photography rights. Build adapters and flags so these decisions do not require a rewrite. Demo mode remains usable while they are unresolved, but live checkout stays disabled.
