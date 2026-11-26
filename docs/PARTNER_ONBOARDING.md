# Onboarding partners

How a business becomes a Fastlife partner: what the app does, what the
team checks by hand, and what still needs building. For the portal itself
(listings, approvals, dashboard) see [PARTNER_PORTAL.md](PARTNER_PORTAL.md).

## One account, two front doors

Partners use the same account and the same sign-in page as travellers. Being
a partner is a membership linking an account to a business, so someone can
run a business and still book trips. There is no separate partner password.

What makes it feel separate:

| Where                     | What partners see                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `/partner`, signed out    | What partnering is, the four steps, **Apply to become a partner** and **Partner sign in**     |
| Footer → For partners     | Partner with us, Partner sign in                                                              |
| `/account?next=/partner…` | "Sign in to your partner account" or "Create your partner account" instead of trip wording    |
| Header, once signed in    | **Partner portal** (verified) or **Partner application** (pending), for partner accounts only |
| `/account`, signed in     | The same link under the account details                                                       |

The main header has no partner button for everyone: most visitors are
travellers.

## Two ways to onboard

### A. The business applies (inbound)

1. They open `/partner` (footer → Partner with us) and press **Apply to become
   a partner**. That opens Create account and comes back to `/partner`.
2. They fill in business name, contact email, phone and what they run, and
   send. Status: Waiting for review.
3. The team does the checks below, then in `/admin#partners` → Partner
   applications presses **Verify partner**, or **Decline** with a reason (the
   partner sees it, corrects the details and sends again).
4. The partner signs in again (or refreshes) and sees their portal.

### B. Fastlife invites the business (outbound)

For businesses the team has already met and checked.

1. In `/admin#partners` → Invitations → **Invite a partner**, enter business
   name, contact email, phone and what they run, and press **Create
   invitation link**.
2. Copy the link and send it by WhatsApp or email. It's shown once and works
   for 14 days. Only a hash of it is stored.
3. They open it, see "You're invited to list <business>", create an account or
   sign in, and press **Accept invitation**. Their partner account is created
   **verified**, owned by that account, and the portal opens.
4. The invitation shows as Accepted. Open ones can be cancelled; a lost or
   expired link means making a new one.

Rules: a link works once. An account that already runs a partner can't accept
(they're told to use another account). An account with its own pending or
declined application has that application replaced and verified with the
invite's details. Every step is in the audit log (`PARTNER_INVITED`,
`PARTNER_INVITE_ACCEPTED`, `PARTNER_INVITE_REVOKED`).

## Checks before verifying or inviting

The app records the decision, not the evidence, so for now keep a checklist
per partner (a sheet or a Trello card) with:

- **Who they are:** CAC registration (or a reason they have none), a phone
  call with the owner, and for anything physical (boats, venues, vehicles) a
  site visit, photos or references.
- **Licences and insurance** where the activity needs them: water safety,
  transport, park or venue permits.
- **Agreement:** commission (the app assumes 15% until rates are agreed),
  confirmation time after a booking, cancellation and refund rules, no-shows.
- **Payout details:** bank account in the business or owner's name. The app
  doesn't store these or pay partners yet.

## After verification

1. The partner adds an activity or ready-made trip (Listings & trips → New),
   fills it in with photos and submits it.
2. Staff approve it (**Approve & publish**) or send it back with a note in
   `/admin#partners` → Waiting for approval.
3. Once live, travellers can book it and the partner's dashboard shows views,
   visitors, saves, trip plans and sales.

## What's missing before real partners sell

| Gap                                             | Why it matters                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Partners can't confirm or decline bookings      | Paid bookings stay "waiting for partner to confirm"              |
| No payout details or settlements                | Money can be taken but not settled with partners in the app      |
| No verification checklist or documents in admin | Checks live outside the app, with no record next to the decision |
| Invitations aren't emailed                      | Staff copy the link and send it themselves                       |
| No invitations for a partner's own staff        | One account per business for now                                 |

Suggested order: booking confirm/decline, then the verification checklist with
document uploads, then payout details and settlements.

## Trying it locally

After `npm run db:migrate` (adds `0013_partner_invites`):

1. Signed out, open `/partner`: the welcome page with both buttons.
2. As an admin, `/admin#partners` → Invitations → Invite a partner → copy the
   link.
3. In a private window, open the link → Create account → Accept invitation →
   the portal opens, verified.
