---
tags: [user-journey]
updated: 2026-11-22
---
# User Journey

How a traveller starts and finishes a booking on Fastlife, told step by step.
Every step is a note named after the **file and the exact function** that runs,
linked to the step that called it and the steps it triggers. Open
[[User Journey.canvas|the canvas]] to see it as a diagram, or the graph view
filtered to `tag:#user-journey`.

There are two ways to book. Both end at **Pay**, which is switched off in this
preview: nothing is held or charged.

## Story 1 · Ada books one activity

Ada lives in Lagos and wants something for Saturday. She never makes a trip:
she browses, books one activity and reaches payment. She can do it as a guest
until checkout, where she signs in.

1. [[A01 Home page › Home|Home page › Home]] — Lands on the home page and taps **Things to do** (or a category).
2. [[A02 Explore page › Explore|Explore page › Explore]] — Sees every published activity, with filters for date, price, area and family.
3. [[A03 Catalogue browser › CatalogueBrowser|Catalogue browser › CatalogueBrowser]] — Filters the list and opens an activity card.
4. [[A04 Experience overlay › ExperienceOverlay|Experience overlay › ExperienceOverlay]] — Reads the details in a dialog and taps **Book this experience**.
5. [[A05 Experience page › Detail|Experience page › Detail]] — Arrives on the activity page with the booking panel already open.
6. [[A06 Booking panel › Panel|Booking panel › Panel]] — Picks a date, a start time and guests; confirms how they'll get back if it ends late.
7. [[A07 schedule › startTimesOn|schedule › startTimesOn]] — Sees the start times for the chosen day.
8. [[A08 bookings cart › experienceLinePrice|bookings cart › experienceLinePrice]] — Sees the price for adults, children and pickup.
9. [[A09 Booking panel › bookNow|Booking panel › bookNow]] — Taps **Book now** (or **Add to cart** to keep browsing).
10. [[A10 use-cart › useCart.add|use-cart › useCart.add]] — Nothing visible: the cart badge in the header goes up by one.
11. [[A16 Cart page › CartPage|Cart page › CartPage]] — Reviews everything in the cart, edits or removes lines, and taps **Review and checkout**.
12. [[A11 Checkout page › Checkout|Checkout page › Checkout]] — Is asked to sign in if they browsed as a guest; otherwise sees the review.
13. [[A12 Checkout review › CheckoutReview|Checkout review › CheckoutReview]] — Checks each booking, adds a phone number and ticks the terms.
14. [[A13 Cart › useCartView|Cart › useCartView]] — Sees each line with its date, time, guests and total.
15. [[A14 bookings cart › cartTotals|bookings cart › cartTotals]] — Sees the subtotal, service fee and total.
16. [[A15 Checkout review › Pay (preview)|Checkout review › Pay (preview)]] — Reaches **Pay**. In this preview it stays disabled and explains why.

## Story 2 · Tunde plans a week and books it

Tunde is visiting from London with his family. He describes the trip to Kemi,
saves it, plans each day, chooses a driver for some days and his own way for
others, adds his pickup address when he's ready, and reviews the whole trip.

1. [[B01 Home page › Plan with Kemi|Home page › Plan with Kemi]] — Taps **Plan with Kemi** on the home page.
2. [[B02 New plan page › NewPlan|New plan page › NewPlan]] — Signs in if needed, then sees the trip form.
3. [[B03 Trip details › Intake|Trip details › Intake]] — Talks to Kemi or fills in the form: dates, people, interests, who books the stay, pickup address or area, car or own way, guides, budget.
4. [[B04 Trip details › askKemi|Trip details › askKemi]] — Writes something like *"5 days in December, 2 adults, book a hotel for us"*.
5. [[B05 Intake API › createIntakeController|Intake API › createIntakeController]] — Waits a moment.
6. [[B06 SuggestProfile › execute|SuggestProfile › execute]] — —
7. [[B07 intake › extractProfile|intake › extractProfile]] — Sees the summary filled in from their words.
8. [[B08 Trip details › review|Trip details › review]] — Checks the summary and taps **Save**.
9. [[B09 Trip details › save|Trip details › save]] — Waits for "Saving your trip…".
10. [[B10 Trips API › createCreateTripController|Trips API › createCreateTripController]] — —
11. [[B11 CreateTrip › execute|CreateTrip › execute]] — —
12. [[B12 OfferSelection › keepPublished|OfferSelection › keepPublished]] — —
13. [[B13 Trip repository › create|Trip repository › create]] — Sees "Saved" with next steps.
14. [[B14 Active trip › activateTrip|Active trip › activateTrip]] — Taps **Go to my drafts** (or **Explore experiences** to add more ideas).
15. [[B15 My plans › MyTrips|My plans › MyTrips]] — Sees the trip card (with **Add your pickup address** if it's still missing) and taps **Open planner**.
16. [[B16 Plan page › Plan|Plan page › Plan]] — Opens the day-by-day planner.
17. [[B17 Planner › load workspace|Planner › load workspace]] — Sees their days, the activity library, the driver line for each day and the trip cost.
18. [[B18 Activity card › PlannerActivityCard|Activity card › PlannerActivityCard]] — Taps **Add to day** on an activity (or drags it onto the timeline).
19. [[B19 Planner › add|Planner › add]] — Sees the edit dialog with the first time that fits.
20. [[B20 planner › availableStarts|planner › availableStarts]] — —
21. [[B21 Planner › commitCandidate|Planner › commitCandidate]] — Taps **Save** in the dialog.
22. [[B22 Planner › change|Planner › change]] — Sees the activity on the timeline and "Unsaved changes · updating estimate…".
23. [[B23 planner › fitCar|planner › fitCar]] — Sees **Driver 08:45–16:45 · 8 hours** above the day.
24. [[B24 Planner › save (autosave)|Planner › save (autosave)]] — Sees "Saved · estimate updated".
25. [[B25 Workspace API › createSaveWorkspaceController|Workspace API › createSaveWorkspaceController]] — —
26. [[B26 SaveWorkspace › execute|SaveWorkspace › execute]] — —
27. [[B27 Trip repository › update|Trip repository › update]] — —
28. [[B28 Driver & guides page › ServicesPage|Driver & guides page › ServicesPage]] — Taps **Driver & guides** (or a "Fix in Driver & guides" link on a warning).
29. [[B29 Planner › day transport controls|Planner › day transport controls]] — Chooses car or own way for the day, the car's hours (or **Fit to my plan**), a night car, guides, or "I'll arrange our own way back".
30. [[B30 Planner › saveBase|Planner › saveBase]] — Adds a pickup address (or area) from the warning and taps **Save address**.
31. [[B31 UpdateTripProfile › execute|UpdateTripProfile › execute]] — Sees "Saved · pickups from …"; the reminder disappears.
32. [[B32 Checkout prompt › proceed|Checkout prompt › proceed]] — Taps **Review and checkout** (and confirms if some days are still free).
33. [[B33 Trip checkout page › CheckoutPage|Trip checkout page › CheckoutPage]] — Opens the trip review.
34. [[B34 Trip checkout › Checkout|Trip checkout › Checkout]] — Sees free days, anything still blocking payment, the pickup address reminder if it's missing, the cost by day, and **Pay** (disabled in this preview).

## Shared steps

Used by both stories: signing in, loading published activities, loading a
trip's workspace and the pricing rules.

1. [[S01 Page guards › requireSignedIn|Page guards › requireSignedIn]] — If signed out: goes to `/account` and comes back after signing in.
2. [[S02 ListPublishedExperiences › execute|ListPublishedExperiences › execute]] — —
3. [[S03 Catalogue repository › listPublished|Catalogue repository › listPublished]] — —
4. [[S04 experience › toPublishedExperience|experience › toPublishedExperience]] — —
5. [[S05 planner › assess|planner › assess]] — Sees the trip cost, "things to sort out before booking" and planning tips.
6. [[S06 planner › placementIssues|planner › placementIssues]] — Sees why a time doesn't fit (e.g. "This time is already occupied").
7. [[S07 Workspace API › createGetWorkspaceController|Workspace API › createGetWorkspaceController]] — —
8. [[S08 Owned trip › createOwnedTripLoader|Owned trip › createOwnedTripLoader]] — —
9. [[S09 GetWorkspace › execute|GetWorkspace › execute]] — —
10. [[S10 Transport settings › get|Transport settings › get]] — —
11. [[S11 planner › pickupReminder|planner › pickupReminder]] — Sees "Add your pickup address by …" until they add it.

## How to read a step note

- **The traveller** — what they see or do at this point.
- **What runs** — what the function does.
- **Called from / Next** — the links that make the chain. Labels show the call
  or HTTP request between the two.
- The properties hold the `file`, `function` and `line` (lines as of the date
  above; the function name is the stable reference).

## Where the story is unfinished

- Payment, orders and partner confirmation (both stories end at a disabled
  **Pay**).
- Reminders outside the app: the pickup address reminder only shows in the
  planner, checkout, today view and My plans.
- The cart and a planned trip don't know about each other.
