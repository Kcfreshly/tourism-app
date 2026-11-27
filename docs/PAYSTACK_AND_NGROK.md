# Paystack payments and the ngrok webhook, in plain words

## How a payment works

1. **Traveller clicks Pay.** Our server re-prices the cart, holds the places for
   15 minutes and asks Paystack to start a transaction
   (`POST /transaction/initialize`) with the amount, our own `reference` and a
   `callback_url`.
2. **Paystack gives back a link** (`authorization_url`). We send the traveller there.
3. **Traveller pays on Paystack's page.** Card details go to Paystack, never to us.
4. **Paystack tells us the result in two ways:**
   - **Browser redirect:** the traveller is sent back to `/checkout/return?reference=…`.
     That page asks Paystack "did this reference really pay?"
     (`GET /transaction/verify/:reference`).
   - **Webhook:** Paystack's own server calls
     `POST /api/v1/payments/paystack/webhook` with a `charge.success` event.
5. **Both paths call the same "confirm payment" step.** It checks the amount,
   currency and reference match, marks the checkout `PAID` and creates the
   order and bookings. It is safe to run twice: whichever arrives first wins,
   the second just finds it already paid.

Code: `src/modules/bookings/infrastructure/payments/paystack-gateway.ts`,
`src/modules/bookings/application/use-cases/record-payment-event.ts`,
the webhook controller in
`src/modules/bookings/presentation/http/controllers/checkout-controllers.ts`.

## Why we need the webhook as well as the redirect

The redirect depends on the traveller's browser. If they close the tab, lose
signal or the phone dies after paying, the redirect never happens. The
webhook goes server to server, so we still learn the money arrived.
Paystack also retries the webhook if we don't answer 200.

## How we trust the webhook

Anyone could POST to that URL, so every request is checked:

- Paystack signs the body with our secret key (HMAC-SHA512) in the
  `x-paystack-signature` header. We recompute it and reject (401) if it
  doesn't match.
- Each event is stored in `payment_events` first; a repeat delivery is ignored.
- We never trust the amount in the webhook alone; confirm payment checks it
  against what we held.

## Why ngrok

Paystack's servers are on the internet. Our dev app runs on
`http://127.0.0.1:3000`, which only exists on this laptop, so Paystack can't
reach it. ngrok opens a public HTTPS address that forwards to the laptop:

```
Paystack server ──► https://<random>.ngrok-free.app/api/v1/payments/paystack/webhook
                         │  (ngrok tunnel)
                         ▼
                  http://127.0.0.1:3000/api/v1/payments/paystack/webhook
```

Setup:

1. `npm run dev`
2. `ngrok http 3000`, copy the `https://…ngrok-free.app` address.
3. Paystack dashboard → Settings → API Keys & Webhooks → **Test Webhook URL**:
   `https://<random>.ngrok-free.app/api/v1/payments/paystack/webhook`
4. Pay with a Paystack test card. ngrok's inspector (`http://127.0.0.1:4040`)
   shows each webhook and our response.

Notes:

- The free ngrok address changes each restart, so update the dashboard URL each time.
- Without ngrok, payments still complete locally through the return page;
  only the webhook path (closed tab case) goes untested.
- In production the app has a real public domain, so ngrok is not used; the
  dashboard points at that domain's webhook URL instead.
