# Nigeria Tourism Platform — Product Flow Draft
Date: 15 October 2026
Status: Initial requirements draft; proposed operating rules require validation.

## Product goal
Let a traveller plan and book activities, choose the level of assistance they want, and receive a coordinated experience from airport arrival through daily outings.

## 1. Enter trip details
Collect city, dates, party size, accommodation or pickup location, budget, interests, accessibility needs, and arrival/departure details where relevant. Users may browse activities before supplying all trip details.

## 2. Build the itinerary
Offer activity browsing and an AI-assisted planning path. AI proposes a day-by-day itinerary using the traveller's preferences; the traveller can add, remove, reorder, or change the duration of activities. Allow time for travel and breaks. Present suggested items separately from confirmed bookings.

## 3. Choose assistance
Let the traveller choose:
- Tickets/reservations only: traveller arranges their own movement.
- Driver transfers: scheduled pickup and drop-off for selected activities.
- Guide for an activity or defined time block.
- Guide for a full day, with agreed hours and availability.
Treat transport and guide coverage as separate choices. Specify whether a driver waits or returns later, and whether a guide accompanies the traveller or remains available nearby.

## 4. Add arrival services
Optional airport greeting, connectivity assistance, transfer to accommodation, and arrival coordination. Show meeting point, contact details, included services, and price. SIM, eSIM, or Wi-Fi options depend on partner availability and applicable activation requirements; pre-registration is an unvalidated proposal, not a promised feature.

## 5. Review and pay
Show each activity, ticket, reservation, transfer, guide assignment request, arrival extra, service fee, and total. State what a restaurant booking includes; food and drinks are not automatically included. Show cancellation terms and any request awaiting confirmation before payment.
Proposed V1 rule: operations checks supplier availability and final pricing before issuing a payment request. If payment happens before final confirmation, disclose that status and the refund process clearly.

## 6. Confirm arrangements
Operations confirms each supplier, guide, driver, ticket, and reservation. Release a final itinerary with booking references, pickup windows, meeting points, contacts, inclusions, and outstanding items. A payment receipt must not be presented as proof that every supplier has confirmed.

## 7. Deliver airport arrival
Assigned representative meets the traveller at the agreed location, helps with the selected connectivity service, and coordinates the assigned vehicle. Track arrival and transfer completion. For flight changes or missed meetings, provide a contact and a revised arrangement.

## 8. Run each day
Show the day's schedule, tickets, assigned contacts, pickup details, and next destination. Send reminders and let travellers request help or changes.
Example: home pickup → beach entry → five-hour visit → scheduled return pickup → restaurant or accommodation.
Drivers receive the pickup time and place. Guides receive the scope of their assignment. A late exit or changed destination triggers coordination and any extra-charge approval.

## 9. Handle changes and disruptions
Provide one support contact. Operations handles supplier cancellations, delayed drivers, venue closure, traveller lateness, and change requests. Offer a feasible alternative, revised timing, or refund where applicable. Obtain traveller agreement before adding charges or substituting a materially different service.

## 10. Complete the trip
Record completed services, reconcile extra charges or refunds, collect activity and service feedback, and invite rebooking.

## Operations workspace
Track travellers, itinerary items, suppliers, guide/driver assignments, payments, confirmations, support issues, and completion.
Suggested item states: Requested → Availability checked → Confirmed → In progress → Completed; also Cancelled or Failed.
Keep payment, supplier confirmation, and refunds as separate statuses.

## Suggested first-version scope
A small curated activity catalogue, editable itinerary, assistance selections, arrival add-ons, itemised quote/payment, confirmation details, and a simple operations workspace. Staff can coordinate suppliers manually while the customer has one coherent trip view.
Broader supplier integrations, automatic dispatch, live tracking, and the separate KYC product are future scope unless explicitly prioritised.

## Acceptance criteria
- A traveller can browse and create a trip without choosing a guide.
- Guide coverage and transport choices are recorded independently with explicit times.
- The traveller sees inclusions, fees, and confirmation status before committing.
- Operations can identify every unconfirmed itinerary item and unassigned transfer.
- The confirmed itinerary includes the information needed to attend each activity.
- Changes preserve the original booking history and record approval for extra charges.

## Open decisions
- Which city and curated activities launch first?
- Who supplies airport greeting, connectivity, drivers, and guides?
- What hours, waiting allowances, and change charges apply?
- Which payment and cancellation policy will the business adopt?
- Will accommodation be booked through the platform or supplied by the traveller?

