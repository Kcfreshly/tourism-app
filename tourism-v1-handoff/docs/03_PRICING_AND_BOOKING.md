# Pricing, inventory and checkout

## Principles

Instant pricing is a core requirement. Prices come from versioned business rules and verified offers, never an LLM. Payment is immediate when the itinerary is sellable. Staff handle supplier configuration, named assignments and exceptions; there is no routine manual quotation gate.

A price estimate does not reserve inventory. Checkout acquires a short-lived hold on the complete bundle: activity seats/groups, vehicles, guide time and selected arrival services. No component sold without known capacity. A capacity pool can stand in for named personnel only when backed by agreed fulfilment capacity; later naming a driver is an assignment, not a new availability gamble.

## Money and price bases

Currency NGN; one naira = 100 minor units. Use integer calculations with explicitly defined half-up rounding for fees. Price bases in V1: PER_ADULT (rate × adults), PER_GROUP (one rate up to max group size), PER_VEHICLE_BLOCK (blocks × vehicles × rate), PER_GUIDE_BLOCK and FIXED_ADDON. Children are not enabled in demo/live default. Amounts in fixtures are fictional.

Activity subtotal = sum of eligible selected offer rates. Mandatory host included in an offer is not billed again for that activity. Full-day guides are an additional service with a disclosed scope; if the offer already includes the same host coverage, suppress overlapping optional host charges rather than charging twice.

Transport V1 proposed policy: reserve a dedicated vehicle per supported day. Sell fixed 4-hour or 8-hour blocks; windows >8 hours are unavailable until an explicit overtime/evening product is configured. Include required driver reposition/start/end buffers in inventory intervals. Never silently round a 10-hour day down to eight hours. A day with only private custom blocks does not automatically buy transport. Airport transfer is separate unless its inclusion is explicit.

Vehicle count = ceil(partySize / passengerCapacity), with luggage/arrival limits checked separately. Vehicle block price uses configured service zone/time band. Cross-zone trips add a configured disclosed surcharge per vehicle; V1 does not calculate invented real-time distance fares. Unknown zones or missing rates block checkout. Gaps between morning and evening count as reserved time if the same dedicated vehicle is retained; optional split service is future scope.

Full-day guide uses an 8-hour configured block per covered day and a max-party limit; selected-activity guide uses configured blocks for the eligible activity plus buffers. No assumed overnight availability. Rates, cutoff and cancellation rules are stored per product version.

Merchandise subtotal = activities + transport + optional hosting + arrival add-ons. Platform service fee = configured basis points × eligible subtotal, rounded half-up. Proposed demo fee 1000 bps (10%). Tax behavior is unconfigured for live use until reviewed; demo tax is zero and labelled demo, not tax-exempt. Total = subtotal + fee + configured tax − eligible discounts (discounts disabled initially). Provider transaction fees are absorbed unless a separately reviewed surcharge is configured and disclosed.

The price response contains each line's quantity, unit, unitRateMinor, totalMinor, inclusion description and rule/source reference; currency, subtotal, fee, tax, total, price version and expiry. UI breakdown groups costs without losing detail. Budget comparison uses this total against the same declared party budget scope.

## Exact demo arithmetic

Two adults: conservation-style experience 12,000 NGN per adult (24,000), gallery-style experience 8,000 per adult (16,000), one eight-hour vehicle 45,000. Subtotal 85,000; fee 8,500; tax 0; total **93,500 NGN / 9,350,000 minor units**. Optional full-day guide 25,000 increases subtotal to 110,000, fee 11,000 and total **121,000 NGN**. These are fictional test values, not current venue prices.

## Checkout transaction

1. Authenticate customer; verify ownership, expected trip version and accepted price ID. Reject blockers. Reprice server-side using current valid rate version; require explicit acceptance if amount or booked terms changed.
2. In a short database transaction lock affected capacity rows in deterministic order. Verify slot cutoffs, supplier verification expiry, party eligibility, service zones and overlapping resources. Acquire all holds or roll back all. Create persisted checkout attempt with 15-minute demo expiry and immutable snapshot/hash.
3. Commit, then initialise payment with provider idempotency using exact amount/currency/reference. Provider timeout creates an uncertain pending attempt; reconcile before creating a duplicate payment. Failed initialisation releases the hold only after determining no payment session can succeed, or lets the safe expiry/reconciliation policy resolve it.
4. Customer pays through hosted provider UI; no raw card handling in this app. Provider redirects to verification screen.
5. Receive signed webhook and/or verify via provider API. Persist unique event first. Validate provider reference, amount, currency and merchant ownership. Under transaction lock the attempt; mark payment succeeded and convert valid held capacity to reservations, create exactly one immutable order and enqueue confirmations.
6. If hold expired or inventory was released before verified payment, do not force oversell. Try atomic reacquisition at the agreed terms only if permitted; otherwise create paid-unfulfilled exception and begin authorised remediation/refund. Traveller sees clear resolution status, not a false confirmed trip.
7. Reconcile pending attempts independently of browser presence. Expiry job and webhook race on locked hold state; exactly one consumes/releases inventory.

Hold countdown derives from server expiresAt; refresh does not extend it without an explicit bounded renewal rule. Do not retain inventory forever when a tab remains open.

## Resource consistency

Use slot capacity counters protected by row locks or database constraints/serialisable transactions. For interval resources lock the pool/date and evaluate overlapping intervals; avoid relying on naive “available” SELECT followed by INSERT. Resource intervals include vehicle travel/reposition and guide handoff buffers. For named assignment use an exclusion constraint or equivalent transactional overlap checks. Tests must run with separate database connections to demonstrate concurrency behavior.

## Supplier confirmations and tickets

V1 sellable supply has fixed rates and agreed availability/capacity. Some products still require issuance of a ticket or supplier reference after payment; this is distinct from capacity reservation. Show “Reserved — ticket pending” with a concrete deadline where applicable. If supplier availability is merely speculative, list the experience as not instantly bookable until an agreement exists. Do not convert the whole product into request-a-quote.

## Changes and cancellations

Before payment: edit freely and reprice. After payment: create a change request. Generate a new proposed immutable snapshot and delta, check replacement capacity, show policy and require customer approval. Reserve replacement capacity before releasing original inventory when possible; no double-sale or lost original booking on a failed change. Extra cost requires a separate verified payment; cheaper changes produce an explicit refund/credit calculation. Rejected changes retain original order.

Cancellation preview uses the booked policy snapshot per line and current provider/supplier facts, never today's replacement policy. Show nonrefundable components and refundable amounts. Customer approval creates durable request and idempotent provider refund. Payment succeeded does not mean refund succeeded. Partial cancellations allocate fees/tax through an explicit reviewed rule. Where no live policy is approved, disable live cancellation automation and expose staff review with honest status; never claim an automatic refund that has not occurred.

Demo policy assumption: fully refundable until 48 hours before the service; nonrefundable after cutoff. Use only for fixtures. Real partner policies and platform-fee treatment must replace this before live checkout.

## Failure messages

- PRICE_CHANGED: “Your plan’s price changed. Review the updated total before paying.”
- CAPACITY_UNAVAILABLE: “This time is no longer available. Choose another time or experience.”
- ROUTE_UNSUPPORTED: “We can’t arrange this route yet. Choose another area or contact us.”
- HOLD_EXPIRED: “Your reservation window ended. Check availability again.”
- PAYMENT_VERIFYING: “We’re checking your payment. You don’t need to pay again.”
- PAYMENT_REQUIRES_REVIEW: “We received your payment and are resolving a booking issue. Your reference is …”
- PROVIDER_UNAVAILABLE: “Payment is temporarily unavailable. Your plan is saved.”

Every error must preserve the user's plan and provide a safe next action.
