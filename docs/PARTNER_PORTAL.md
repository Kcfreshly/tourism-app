# Partner portal

Partners are the businesses that run activities and ready-made trips, such as
a kayak operator in Lekki or a company running three-day trips to Obudu. They
sign in at `/partner`, plan listings, send them to Fastlife for approval, and
see how travellers respond. Built from section 9 of
[PAYMENT_INTEGRATION_PLAN.md](PAYMENT_INTEGRATION_PLAN.md); migration
`0009_partners.sql`.

## Journey

1. **Apply.** Any signed-in account opens `/partner` (footer link "Partner
   with us") and sends its business name, contact email, phone and what it
   runs. The account becomes the business's owner. A pending application can
   be corrected; a declined one can be sent again.
2. **Staff verify the business.** In `/admin` → Partners → Partner
   applications: **Verify partner**, or **Decline** with a reason the partner
   sees. A verified partner can later be **suspended** (reason required) and
   **reinstated**. Suspended partners can't use the portal. Their live
   listings stay on sale until staff unpublish them.
3. **Partner plans a listing.** Overview / Listings & trips → **New** →
   Activity or Ready-made trip. They fill in the same sections staff use
   (story, price and party, schedule, logistics, inclusions, photos; or route,
   departures, price, inclusions and terms for a trip) and **Save draft** as
   often as they like.
4. **Submit for review.** The same readiness checks as staff publishing run
   first (price above ₦0, real venue, story, inclusions; for trips an upcoming
   departure, every day planned, booking terms).
5. **Staff approve or send back.** `/admin` → Partners → Waiting for
   approval shows each submission with its photos, price, venue, schedule and,
   for changes, which fields changed. **Approve & publish** puts it live at
   once. **Send back** needs a note, which the partner sees above the form
   until they resubmit. Listings that run past midnight need the night-time
   security review ticked before approval.
6. **Changing a live listing.** The partner picks it and **Propose a change**.
   This starts a draft copied from the live version. The live version keeps
   selling unchanged until staff approve the change. A listing has at most
   one open change at a time. **Discard draft** drops it.

## What partners can't do

- Publish, unpublish or set a listing's status.
- Tick the review checklist or the night-time security review.
- See the audit history, other partners' listings or anyone's figures but
  their own. Every partner endpoint looks up the partner from the session,
  never from the request.

Staff can still edit any listing directly in the Activities and Ready-made
trips sections; those edits don't go through the partner queue.

## Where things live

| Table                                         | Holds                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `partners`                                    | The business, its status (`PENDING`, `VERIFIED`, `DECLINED`, `SUSPENDED`) and the last decision's reason.                                   |
| `partner_members`                             | Which accounts act for a partner (owner now, staff later). One business per account.                                                        |
| `listing_submissions`                         | Each draft or change: the whole proposed record, its status (`DRAFT`, `PENDING`, `DECLINED`, `APPROVED`, `WITHDRAWN`) and the staff reason. |
| `catalogue.partner_id`, `packages.partner_id` | Who runs a live listing; empty for Fastlife's own.                                                                                          |
| `listing_visits`                              | Views per listing, day and visitor, for the dashboard.                                                                                      |

The catalogue only ever holds what staff approved. A new partner listing is
created when its first submission is approved, with the submission's id, so
approving twice can never create two. Every application, decision, save,
submission, approval and decline writes an audit event, and approved
listings get catalogue snapshots like any staff edit, so they can be deleted
and restored the same way.

## Dashboard

Overview shows the last 30 days against the 30 before:

| Figure              | Source                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Views               | Listing pages and quick views (`POST /api/v1/views`).                                                                               |
| Visitors            | Distinct browsers. Each browser keeps a random id in local storage, which the server hashes. No account or personal data is stored. |
| Saved by travellers | Accounts whose saved bucket holds the activity.                                                                                     |
| In trip plans       | Trip plans that include the activity.                                                                                               |
| Views per day       | Bar chart over the 30 days.                                                                                                         |
| Per listing         | Views, visitors, saves and plans for each live listing.                                                                             |
| Bookings, sales     | Shown as "starts when online payment goes live". They come from the bookings table that checkout will create.                       |

Views by staff and by any partner account aren't counted, so partners see
what travellers do. Saves and plans apply to activities only; trips are kept
in the browser cart, so only their views are counted.

## API

| Route                                           | Who                 | Does                                                    |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------- |
| `GET/POST /api/v1/partner`                      | Signed in           | Own partner (or null); apply or update the application. |
| `GET /api/v1/partner/listings`                  | Verified partner    | Live listings with any open change, plus new drafts.    |
| `POST/PATCH/DELETE /api/v1/partner/submissions` | Verified partner    | Start, save or submit (`submit: true`), withdraw.       |
| `POST /api/v1/partner/media`                    | Verified partner    | Photo upload, same checks as staff.                     |
| `GET /api/v1/partner/dashboard`                 | Verified partner    | The figures above.                                      |
| `GET/PATCH /api/v1/admin/partners`              | Admin               | List partners; verify, decline, suspend, reinstate.     |
| `GET/PATCH /api/v1/admin/submissions`           | Admin               | Queue; approve or decline.                              |
| `GET/POST/DELETE /api/v1/admin/partner-invites` | Admin               | List, create (returns the link once), cancel invites.   |
| `POST /api/v1/partner/invites`                  | Signed in           | Accept an invitation by its token.                      |
| `POST /api/v1/views`                            | Anyone, same origin | Count a view. Throttled per visitor.                    |

How partners find the portal, sign in and get invited is in
[PARTNER_ONBOARDING.md](PARTNER_ONBOARDING.md).

## Trying it locally

With the dev server stopped: `npm run db:migrate`, then `npm run dev`. Sign up
a second account (for example `partner@example.com`), open `/partner` and
apply. In another browser, sign in as your admin, verify the partner under
`/admin#partners`, then create, submit and approve a listing.

## Not built yet

- Invitations for a partner's own staff (STAFF members). Staff invitations
  of new businesses are built; see [PARTNER_ONBOARDING.md](PARTNER_ONBOARDING.md).
- Bookings, confirmation queue, manifests and payouts. These follow checkout
  (plan sections 4 and 9).
- Pausing a partner's own live listing without staff.
- Automatically unpublishing a suspended partner's listings.
- Notifications. Partners and staff check their queues.
