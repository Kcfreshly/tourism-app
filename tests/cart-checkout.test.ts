import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database/client";
import { sqlStatements } from "../src/database/sql-statements";
import { AppError } from "../src/shared/application/app-error";
import {
  toPublishedExperience,
  type Experience,
} from "../src/modules/catalogue/domain/experience";
import {
  demoPackages,
  type TripPackage,
} from "../src/modules/catalogue/domain/packages";
import { lagosToday } from "../src/modules/catalogue/domain/events";
import {
  addDays,
  nextRunDates,
  startTimesOn,
} from "../src/modules/catalogue/domain/schedule";
import {
  cartTotals,
  mergeCarts,
  type CartLine,
} from "../src/modules/bookings/domain/cart";
import {
  resolveLine,
  type Bookable,
} from "../src/modules/bookings/domain/resolve-line";
import type { StartCheckoutInput } from "../src/modules/bookings/domain/checkout";
import {
  PaymentProviderUnavailable,
  type PaymentGateway,
  type VerifiedPayment,
} from "../src/modules/bookings/application/ports/payment-gateway";
import type { Notifier } from "../src/modules/bookings/application/ports/notifier";
import { CartPricing } from "../src/modules/bookings/application/services/cart-pricing";
import { SaveCart } from "../src/modules/bookings/application/use-cases/cart";
import { StartCheckout } from "../src/modules/bookings/application/use-cases/start-checkout";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import {
  ConfirmOwnPayment,
  ConfirmPayment,
} from "../src/modules/bookings/application/use-cases/confirm-payment";
import { RecordPaymentEvent } from "../src/modules/bookings/application/use-cases/record-payment-event";
import { DrizzleCartRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-cart-repository";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import { paystackSignatureValid } from "../src/modules/bookings/infrastructure/payments/paystack-gateway";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const checkouts = new DrizzleCheckoutRepository(() => db);
const carts = new DrizzleCartRepository(() => db);

const today = lagosToday();
const listing = (seedKey: string) =>
  toPublishedExperience({
    id: randomUUID(),
    seedKey,
    record: fixture.experiences.find((e) => e.id === seedKey) as Experience,
  });
// One group per session, confirmed by the partner.
const market = listing("local-market");
// Eight places per day, instant confirmation.
const walk = listing("nature-walk");
const trip: TripPackage = {
  ...demoPackages[0],
  departures: [{ date: addDays(today, 30), seats: "OPEN", capacity: 3 }],
};
const partnerId = randomUUID();
const bookables: Bookable[] = [
  { kind: "EXPERIENCE", productId: market.id, partnerId, listing: market },
  { kind: "EXPERIENCE", productId: walk.id, partnerId: null, listing: walk },
  { kind: "PACKAGE", productId: trip.slug, partnerId: null, trip },
];
const pricing = new CartPricing({ load: async () => bookables }, checkouts);

const marketDate = nextRunDates(market, addDays(today, 3), 1)[0];
const marketTime = startTimesOn(market, marketDate)[0];
const walkDate = nextRunDates(walk, addDays(today, 3), 1)[0];

function marketLine(): CartLine {
  return {
    kind: "EXPERIENCE",
    id: randomUUID(),
    offerId: market.offer.id,
    date: marketDate,
    time: marketTime,
    adults: 2,
    children: 0,
    childAges: [],
    pickup: false,
    pickupAddress: "",
  };
}
function walkLine(adults = 2): CartLine {
  return {
    kind: "EXPERIENCE",
    id: randomUUID(),
    offerId: walk.offer.id,
    date: walkDate,
    time: startTimesOn(walk, walkDate)[0],
    adults,
    children: 0,
    childAges: [],
    pickup: false,
    pickupAddress: "",
  };
}

// A provider whose answers the test sets.
class FakeGateway implements PaymentGateway {
  readonly provider = "FAKE";
  down = false;
  results = new Map<string, Partial<VerifiedPayment>>();
  amounts = new Map<string, number>();
  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    if (this.down) throw new PaymentProviderUnavailable("down");
    this.amounts.set(input.reference, input.amountMinor);
    return {
      authorizationUrl: `https://pay.test/${input.reference}`,
      accessCode: "ac",
    };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    return {
      status: "PENDING",
      amountMinor: this.amounts.get(reference) ?? 0,
      currency: "NGN",
      channel: "card",
      paidAt: new Date(),
      payload: {},
      ...this.results.get(reference),
    };
  }
  pay(reference: string, extra: Partial<VerifiedPayment> = {}) {
    this.results.set(reference, { status: "SUCCESS", ...extra });
  }
}
const notes: string[] = [];
const notifier: Notifier = {
  async orderPaid(e) {
    notes.push(`paid ${e.orderReference}`);
  },
  async needsReview(e) {
    notes.push(`review ${e.reason}`);
  },
};

let gateway: FakeGateway;
let clock: Date;
let start: StartCheckout;
let confirm: ConfirmPayment;

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  for (const id of ["u1", "u2", "u3"])
    await pg.query(
      "INSERT INTO auth_user (id, name, email) VALUES ($1, $1, $1 || '@example.com')",
      [id],
    );
  await pg.query(
    "INSERT INTO partners (id, business_name, contact_email, phone, offering, status) VALUES ($1, 'Market Hosts', 'm@example.com', '+2348000000000', 'tours', 'VERIFIED')",
    [partnerId],
  );
});

beforeEach(async () => {
  // Each test starts with no holds, bookings or carts.
  await pg.exec(
    "TRUNCATE service_request_history, service_requests, booking_status_history, bookings, orders, payments, payment_events, checkout_lines, checkouts, inventory_slots, account_carts",
  );
  gateway = new FakeGateway();
  clock = new Date();
  start = new StartCheckout(
    pricing,
    checkouts,
    new PaymentStarter(
      checkouts,
      () => gateway,
      () => "http://app.test/checkout/return",
    ),
    () => clock,
  );
  confirm = new ConfirmPayment(
    checkouts,
    () => gateway,
    notifier,
    () => clock,
  );
});

const contact = { name: "Ada Lovelace", phone: "+234 801 234 5678" };
async function input(lines: CartLine[]): Promise<StartCheckoutInput> {
  const { quote } = await pricing.price(lines, clock);
  return {
    lines,
    shownTotalMinor: quote.totals.totalMinor,
    contact,
    agreed: true,
  };
}
async function pay(userId: string, lines: CartLine[], key = randomUUID()) {
  return start.execute({
    user: { id: userId, email: `${userId}@example.com` },
    idempotencyKey: key,
    input: await input(lines),
  });
}
const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof AppError ? e : Promise.reject(e)),
  );
const referenceOf = (r: Awaited<ReturnType<typeof pay>>) =>
  r.status === "PAYMENT_REDIRECT" ? r.reference : "";

describe("cart rules", () => {
  it("merges a guest cart into the saved one at sign-in", () => {
    const saved = [walkLine(), marketLine()];
    const guest = [{ ...walkLine(4), date: saved[0].date }];
    const merged = mergeCarts(saved, guest);
    // The guest's line for the same booking replaces the saved one.
    expect(merged.lines.map((l) => l.id)).toEqual([saved[1].id, guest[0].id]);
    const many = Array.from({ length: 19 }, () => marketLine()).map((l, i) => ({
      ...l,
      time: `0${i % 10}:00`,
      date: addDays(today, 10 + i),
    }));
    expect(mergeCarts(many, [walkLine(), marketLine()]).dropped).toBe(1);
  });

  it("finds what needs fixing before checkout", () => {
    const now = Date.now();
    const product = bookables[1];
    const kid = { ...walkLine(), children: 1, childAges: [] };
    expect(resolveLine(kid, product, now).problem).toMatch(/child’s age/);
    const young = { ...kid, childAges: [3] };
    expect(resolveLine(young, product, now).problem).toMatch(/at least 5/);
    const past = { ...walkLine(), date: addDays(today, -1) };
    expect(resolveLine(past, product, now).problem).toMatch(/No longer runs/);
    const full = {
      kind: "PACKAGE" as const,
      id: "p",
      packageSlug: trip.slug,
      date: addDays(today, 30),
      travellers: 2,
      singleRooms: 0,
    };
    expect(resolveLine(full, bookables[2], now).problem).toBeUndefined();
    const closed: Bookable = {
      ...bookables[2],
      kind: "PACKAGE",
      trip: { ...trip, departures: [{ ...trip.departures[0], seats: "FULL" }] },
    } as Bookable;
    expect(resolveLine(full, closed, now).problem).toMatch(/no longer/);
    expect(resolveLine(walkLine(), undefined, now).problem).toMatch(/listed/);
  });

  it("refuses a stale cart save", async () => {
    const save = new SaveCart(carts);
    const first = await save.execute({
      userId: "u1",
      lines: [walkLine()],
      expectedVersion: 0,
    });
    expect(first.version).toBe(1);
    const stale = await refusal(
      save.execute({ userId: "u1", lines: [], expectedVersion: 0 }),
    );
    expect(stale?.code).toBe("VERSION_CONFLICT");
  });
});

describe("checkout", () => {
  it("holds places and opens one payment per Pay press", async () => {
    const lines = [walkLine(), marketLine()];
    const key = randomUUID();
    const first = await pay("u1", lines, key);
    expect(first.status).toBe("PAYMENT_REDIRECT");
    // A double press continues the same checkout.
    const again = await pay("u1", lines, key);
    expect(again).toEqual(first);
    const { quote } = await pricing.price([marketLine()], clock);
    expect(quote.lines[0].problem).toBe("Sold out for this date.");
    // Someone else can't reuse the key.
    const stolen = await refusal(pay("u2", lines, key));
    expect(stolen?.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("refuses a total the server doesn't agree with", async () => {
    const lines = [walkLine()];
    const shown = await input(lines);
    const changed = await refusal(
      start.execute({
        user: { id: "u1", email: "u1@example.com" },
        idempotencyKey: randomUUID(),
        input: { ...shown, shownTotalMinor: shown.shownTotalMinor - 100 },
      }),
    );
    expect(changed?.code).toBe("PRICE_CHANGED");
    expect(
      (changed?.details as { quote: { totals: { totalMinor: number } } }).quote
        .totals.totalMinor,
    ).toBe(shown.shownTotalMinor);
    const bad = await refusal(
      start.execute({
        user: { id: "u1", email: "u1@example.com" },
        idempotencyKey: randomUUID(),
        input: {
          ...shown,
          lines: [{ ...walkLine(), date: addDays(today, -2) }],
        },
      }),
    );
    expect(bad?.code).toBe("LINE_UNAVAILABLE");
  });

  it("sells the last place once when two carts race for it", async () => {
    const results = await Promise.allSettled([
      pay("u1", [marketLine()]),
      pay("u2", [marketLine()]),
    ]);
    const held = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(held).toHaveLength(1);
    expect((refused[0].reason as AppError).code).toBe("CAPACITY_UNAVAILABLE");
  });

  it("keeps the hold when the provider is down, and resumes on retry", async () => {
    gateway.down = true;
    const key = randomUUID();
    const lines = [marketLine()];
    const down = await refusal(pay("u1", lines, key));
    expect(down?.code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
    expect(down?.kind).toBe("UNAVAILABLE");
    // The place stays held for this traveller: the quote shows it sold out.
    const other = await refusal(pay("u2", [marketLine()]));
    expect(other?.code).toBe("LINE_UNAVAILABLE");
    gateway.down = false;
    expect((await pay("u1", lines, key)).status).toBe("PAYMENT_REDIRECT");
  });
});

describe("payment", () => {
  it("creates one order with a booking per line, however often it is confirmed", async () => {
    const lines = [walkLine(), marketLine()];
    await carts.save("u1", [...lines, walkLine(1)], 0);
    const reference = referenceOf(await pay("u1", lines));
    expect(await confirm.execute(reference)).toEqual({ status: "PENDING" });
    gateway.pay(reference);
    const paid = await confirm.execute(reference);
    expect(paid.status).toBe("PAID");
    // Webhook and return page racing: still one order.
    const [a, b] = await Promise.all([
      confirm.execute(reference),
      confirm.execute(reference),
    ]);
    expect(a).toEqual(paid);
    expect(b).toEqual(paid);
    expect(notes.filter((n) => n.startsWith("paid"))).toHaveLength(1);

    const [order] = await checkouts.listOrders("u1");
    expect(order.reference).toMatch(/^FL-[2-9A-HJ-NP-Z]{6}$/);
    expect(order.bookings.map((b) => b.status)).toEqual([
      "CONFIRMED",
      "AWAITING_PARTNER",
    ]);
    expect(order.bookings[1].partnerDeadline).not.toBeNull();
    expect(order.totalMinor).toBe(
      cartTotals(order.bookings.map((b) => b.totalMinor - b.feeMinor))
        .totalMinor,
    );
    // Paid lines leave the saved cart; the unpaid one stays.
    expect((await carts.load("u1")).lines).toHaveLength(1);
    expect(await checkouts.findOrder("u2", order.reference)).toBeNull();
    const [{ commission_bps }] = (
      await pg.query<{ commission_bps: number | null }>(
        "SELECT commission_bps FROM bookings WHERE partner_id IS NOT NULL",
      )
    ).rows;
    expect(commission_bps).toBe(1500);
  });

  it("frees the places when a payment fails", async () => {
    const reference = referenceOf(await pay("u1", [marketLine()]));
    gateway.results.set(reference, { status: "FAILED" });
    expect(await confirm.execute(reference)).toEqual({ status: "FAILED" });
    expect((await pay("u2", [marketLine()])).status).toBe("PAYMENT_REDIRECT");
  });

  it("waits on an abandoned payment page while the hold lasts", async () => {
    const reference = referenceOf(await pay("u1", [marketLine()]));
    gateway.results.set(reference, { status: "ABANDONED" });
    expect(await confirm.execute(reference)).toEqual({ status: "PENDING" });
  });

  it("sends a wrong amount for review instead of booking it", async () => {
    const reference = referenceOf(await pay("u1", [walkLine()]));
    gateway.pay(reference, { amountMinor: 100 });
    expect(await confirm.execute(reference)).toEqual({
      status: "REQUIRES_REVIEW",
    });
    expect(await checkouts.listOrders("u1")).toEqual([]);
  });

  it("books a late payment only if its places are still free", async () => {
    const late = referenceOf(await pay("u1", [marketLine()]));
    // The hold lapses, and someone else takes the only place.
    clock = new Date(clock.getTime() + 16 * 60000);
    const taken = referenceOf(await pay("u2", [marketLine()]));
    gateway.pay(taken);
    expect((await confirm.execute(taken)).status).toBe("PAID");
    gateway.pay(late);
    expect(await confirm.execute(late)).toEqual({ status: "REQUIRES_REVIEW" });
    expect(notes).toContain("review CAPACITY_LOST");

    // With room left, a late payment is still booked.
    const roomy = referenceOf(await pay("u3", [walkLine()]));
    clock = new Date(clock.getTime() + 16 * 60000);
    gateway.pay(roomy);
    expect((await confirm.execute(roomy)).status).toBe("PAID");
  });

  it("only shows a payment to the traveller who made it", async () => {
    const reference = referenceOf(await pay("u1", [walkLine()]));
    const own = new ConfirmOwnPayment(checkouts, confirm);
    expect((await own.execute("u1", reference)).status).toBe("PENDING");
    expect((await refusal(own.execute("u2", reference)))?.code).toBe(
      "NOT_FOUND",
    );
  });

  it("handles each webhook delivery once", async () => {
    const reference = referenceOf(await pay("u1", [walkLine()]));
    gateway.pay(reference);
    const record = new RecordPaymentEvent(checkouts, confirm);
    const event = {
      provider: "PAYSTACK",
      event: "charge.success",
      reference,
      payloadSha256: "a".repeat(64),
      payload: { event: "charge.success", data: { reference } },
    };
    expect(await record.execute(event)).toEqual({ handled: true });
    expect(await record.execute(event)).toEqual({ handled: false });
    expect(await checkouts.listOrders("u1")).toHaveLength(1);
  });

  it("checks Paystack webhook signatures", () => {
    const body = '{"event":"charge.success"}';
    const signature = createHmac("sha512", "sk_test_x")
      .update(body)
      .digest("hex");
    expect(paystackSignatureValid("sk_test_x", body, signature)).toBe(true);
    expect(paystackSignatureValid("sk_test_y", body, signature)).toBe(false);
    expect(paystackSignatureValid("sk_test_x", body + " ", signature)).toBe(
      false,
    );
    expect(paystackSignatureValid("sk_test_x", body, null)).toBe(false);
    expect(paystackSignatureValid("sk_test_x", body, "zz")).toBe(false);
  });
});
