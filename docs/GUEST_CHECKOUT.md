# Guest checkout for events

A partner chooses, per event, whether buyers must create an account before
paying. When guest checkout is on, a buyer finds the event, presses Book now,
fills in name, email and phone, and pays. No account is created.

## The partner's choice

- Partner portal → the event listing → **Media** section, under "This is a
  dated event": **Buyers can pay without creating an account**. Staff see the
  same checkbox in the admin listing editor.
- Stored on the listing as `event.guestCheckout` (`true`, or absent for off).
  Like every partner change it goes live when staff approve the submission.
- Off by default, so existing events still ask buyers to sign in.
- Only dated events can offer it; everyday activities and ready-made trips
  always need an account.

## The buyer's journey

| Step               | Signed in                       | Guest (event allows it)                                     |
| ------------------ | ------------------------------- | ----------------------------------------------------------- |
| Event page         | —                               | Booking panel shows "No account needed to buy tickets"      |
| `/checkout`        | Lead guest form, account email  | "Your details": name, **email**, phone; "Sign in" link      |
| Pay                | Paystack with account email     | Paystack with the email typed in                            |
| `/checkout/return` | Matched by account              | Matched by the browser's guest key                          |
| `/bookings/FL-…`   | Account orders                  | Orders bought in this browser; "show this page at the door" |
| `/bookings`        | Account orders (+ guest orders) | Guest orders from this browser, with a sign-in note         |

If a signed-out cart holds anything that needs an account, checkout shows
**Sign in to book** instead of the form, and says when the event tickets
could be bought on their own.

## How ownership works without an account

- On the first guest Pay, the browser sets a random 256-bit key in the
  `fl_guest` cookie (`SameSite=Lax`, one year, `Secure` on https)
  — `src/components/guest-key.ts`.
- The server stores only `sha256(key)` in `checkouts.guest_key_hash`
  (migration `0012_guest_checkout.sql`). `checkouts.user_id`,
  `orders.user_id` and `bookings.user_id` are nullable; a check constraint
  requires one of `user_id` or `guest_key_hash`.
- `canView()` in `bookings/domain/checkout.ts` is the single rule: an account
  checkout belongs to that account; a guest checkout belongs to the browser
  holding its key, also after that browser signs in.
- The cookie is `SameSite=Lax`, so Paystack's redirect back to
  `/checkout/return` carries it.

## Server checks

- `POST /api/v1/checkouts` accepts a caller with no session only when the
  guest key cookie is present and `contact.email` is sent.
- `StartCheckout` refuses a guest (`SIGN_IN_REQUIRED`) unless
  `CartPricing` reports every line as an event with `guestCheckout` on. The
  browser's check is only for the screen; this is the one that counts.
- Guest requests are throttled by client address (`guards.clientAddress()`,
  first `X-Forwarded-For` hop), accounts by account id. Behind a proxy, make
  sure it sets that header.
- `POST /api/v1/cart/quote` is open to guests so their checkout can show the
  server price.
- A new guest Pay lapses that browser's earlier open hold, as for accounts.
- Webhook, settlement, capacity and idempotency are unchanged; an
  Idempotency-Key can't be reused by a different account or browser.

## Limits

- No email provider yet (D8): the guest's only copy is in this browser. If the
  cookie is cleared, staff find the order by reference and email in the
  database. When email arrives, send the receipt with a link to the order.
- Guest orders don't move into an account when the buyer signs up later; they
  stay visible in the browser that bought them.

## Tests

- `tests/guest-checkout.test.ts`: guest purchase end to end, refusal for
  events without the setting and for mixed carts, idempotency per browser,
  order visibility, cookie parsing and hashing.
- Browser check (2026-11-24, simulated payments, desktop 1440 px and phone
  390 px): event badge, guest form and missing-email message, simulated
  payment, order page, My bookings, another browser refused, sign-in screen
  for an event without guest checkout and for a mixed cart, no horizontal
  overflow on the phone form. The partner editor checkbox was not
  checked in a browser.
