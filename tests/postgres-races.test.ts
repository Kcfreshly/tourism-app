// Real concurrency against PostgreSQL: many connections pressing Pay at the
// same moment. PGlite has one connection, so the other tests can't prove
// the row locks work; this one can. It runs only when TEST_POSTGRES_URL
// points at a server where it may create and drop a database, e.g.
//   TEST_POSTGRES_URL=postgres://fastlife:fastlife-dev@127.0.0.1:5440/fastlife npm run test:postgres
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database/client";
import { sqlStatements } from "../src/database/sql-statements";
import {
  toPublishedExperience,
  type Experience,
} from "../src/modules/catalogue/domain/experience";
import { lagosToday } from "../src/modules/catalogue/domain/events";
import {
  addDays,
  nextRunDates,
  startTimesOn,
} from "../src/modules/catalogue/domain/schedule";
import type { CartLine } from "../src/modules/bookings/domain/cart";
import type { Bookable } from "../src/modules/bookings/domain/resolve-line";
import type {
  PaymentGateway,
  VerifiedPayment,
} from "../src/modules/bookings/application/ports/payment-gateway";
import { CartPricing } from "../src/modules/bookings/application/services/cart-pricing";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import { StartCheckout } from "../src/modules/bookings/application/use-cases/start-checkout";
import { ConfirmPayment } from "../src/modules/bookings/application/use-cases/confirm-payment";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";

const url = process.env.TEST_POSTGRES_URL;
const buyers = 25;

const listing = (seedKey: string) =>
  toPublishedExperience({
    id: randomUUID(),
    seedKey,
    record: fixture.experiences.find((e) => e.id === seedKey) as Experience,
  });
// One group per session; eight people per day.
const market = listing("local-market");
const walk = listing("nature-walk");
const bookables: Bookable[] = [
  {
    kind: "EXPERIENCE",
    productId: market.id,
    partnerId: null,
    listing: market,
  },
  { kind: "EXPERIENCE", productId: walk.id, partnerId: null, listing: walk },
];
const marketDate = nextRunDates(market, addDays(lagosToday(), 3), 1)[0];
const walkDate = nextRunDates(walk, addDays(lagosToday(), 3), 1)[0];
const line = (offer: "market" | "walk", adults = 2): CartLine => ({
  kind: "EXPERIENCE",
  id: randomUUID(),
  offerId: offer === "market" ? market.offer.id : walk.offer.id,
  date: offer === "market" ? marketDate : walkDate,
  time:
    offer === "market"
      ? startTimesOn(market, marketDate)[0]
      : startTimesOn(walk, walkDate)[0],
  adults,
  children: 0,
  childAges: [],
  pickup: false,
  pickupAddress: "",
});

class FakeGateway implements PaymentGateway {
  readonly provider = "FAKE";
  amounts = new Map<string, number>();
  opened = 0;
  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    this.opened++;
    this.amounts.set(input.reference, input.amountMinor);
    return {
      authorizationUrl: `https://pay.test/${input.reference}`,
      accessCode: null,
    };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    return {
      status: "SUCCESS",
      amountMinor: this.amounts.get(reference) ?? 0,
      currency: "NGN",
      channel: "card",
      paidAt: new Date(),
      payload: {},
    };
  }
}

describe.skipIf(!url)("PostgreSQL: concurrent checkouts", () => {
  const name = `race_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let db: Database;
  let checkouts: DrizzleCheckoutRepository;
  let gateway: FakeGateway;
  let start: StartCheckout;
  let confirm: ConfirmPayment;

  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    const target = new URL(url!);
    target.pathname = `/${name}`;
    // More connections than buyers' first wave, so requests really overlap.
    client = postgres(target.toString(), { max: 20, onnotice: () => {} });
    for (const file of readdirSync("migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      for (const statement of sqlStatements(
        readFileSync(`migrations/${file}`, "utf8"),
      ))
        await client.unsafe(statement);
    for (let i = 1; i <= buyers; i++)
      await client`INSERT INTO auth_user (id, name, email) VALUES (${`u${i}`}, ${`u${i}`}, ${`u${i}@example.com`})`;
    db = drizzle(client, {
      schema,
      casing: "snake_case",
    }) as unknown as Database;
    checkouts = new DrizzleCheckoutRepository(() => db);
  }, 60000);

  afterAll(async () => {
    await client?.end();
    // The event triggers from migration 0008 guard audit_events, not
    // whole databases, so dropping the test database is allowed.
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
  });

  function fresh() {
    gateway = new FakeGateway();
    const pricing = new CartPricing({ load: async () => bookables }, checkouts);
    start = new StartCheckout(
      pricing,
      checkouts,
      new PaymentStarter(
        checkouts,
        () => gateway,
        () => "http://app.test/r",
      ),
    );
    confirm = new ConfirmPayment(checkouts, () => gateway, {
      orderPaid: async () => {},
      needsReview: async () => {},
      serviceUpdated: async () => {},
      bookingDecided: async () => {},
    });
  }
  async function reset() {
    await client.unsafe(
      "TRUNCATE stay_offers, service_request_history, service_requests, booking_status_history, bookings, orders, payments, payment_events, checkout_lines, checkouts, inventory_slots",
    );
    fresh();
  }
  async function press(i: number, lines: CartLine[], key = randomUUID()) {
    const { quote } = await new CartPricing(
      { load: async () => bookables },
      checkouts,
    ).price(lines, new Date());
    return start.execute({
      user: { id: `u${i}`, email: `u${i}@example.com` },
      idempotencyKey: key,
      input: {
        lines,
        // What each buyer saw before anyone held anything.
        shownTotalMinor: quote.totals.totalMinor || 1,
        contact: { name: "Race Tester", phone: "+234 801 234 5678" },
        agreed: true,
      },
    });
  }
  const outcomes = (results: PromiseSettledResult<unknown>[]) => ({
    held: results.filter((r) => r.status === "fulfilled").length,
    refused: results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason as { code?: string }).code ?? String(r.reason)),
  });

  it(`${buyers} buyers for the last place: exactly one gets it`, async () => {
    await reset();
    const results = await Promise.allSettled(
      Array.from({ length: buyers }, (_, i) => press(i + 1, [line("market")])),
    );
    const { held, refused } = outcomes(results);
    expect(held).toBe(1);
    expect(new Set(refused)).toEqual(
      new Set(
        refused.filter((c) =>
          ["CAPACITY_UNAVAILABLE", "LINE_UNAVAILABLE"].includes(c),
        ),
      ),
    );
    const [{ n }] = await client<{ n: number }[]>`
      SELECT count(*)::int AS n FROM checkouts WHERE status IN ('HELD', 'PAYMENT_PENDING')`;
    expect(n).toBe(1);
  });

  it(`${buyers} buyers of 2 places each for 8 places: exactly four get them`, async () => {
    await reset();
    const results = await Promise.allSettled(
      Array.from({ length: buyers }, (_, i) => press(i + 1, [line("walk", 2)])),
    );
    expect(outcomes(results).held).toBe(4);
    const [{ units }] = await client<{ units: number }[]>`
      SELECT coalesce(sum(l.units), 0)::int AS units FROM checkout_lines l
      JOIN checkouts c ON c.id = l.checkout_id
      WHERE c.status IN ('HELD', 'PAYMENT_PENDING')`;
    expect(units).toBe(8);
  });

  it("the same Pay press sent ten times at once makes one checkout and one payment", async () => {
    await reset();
    const key = randomUUID();
    const lines = [line("walk", 1)];
    const results = await Promise.all(
      Array.from({ length: 10 }, () => press(1, lines, key)),
    );
    // Every press gets the same payment page.
    const pages = results.map((r) =>
      r.status === "PAYMENT_REDIRECT"
        ? `${r.reference} ${r.authorizationUrl}`
        : r.status,
    );
    expect(new Set(pages).size).toBe(1);
    expect(pages[0]).toMatch(/^fl_/);
    const [{ c, p }] = await client<{ c: number; p: number }[]>`
      SELECT (SELECT count(*)::int FROM checkouts) AS c,
             (SELECT count(*)::int FROM payments) AS p`;
    expect({ c, p }).toEqual({ c: 1, p: 1 });
  });

  it("ten confirmations of one payment at once make one order", async () => {
    await reset();
    const started = await press(1, [line("walk", 2)]);
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => confirm.execute(reference)),
    );
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(results[0].status).toBe("PAID");
    const [{ o, b }] = await client<{ o: number; b: number }[]>`
      SELECT (SELECT count(*)::int FROM orders) AS o,
             (SELECT count(*)::int FROM bookings) AS b`;
    expect({ o, b }).toEqual({ o: 1, b: 1 });
  });

  it("buyers paying at once never book more than the places", async () => {
    await reset();
    // Each buyer holds and pays straight away, all at the same time.
    const results = await Promise.allSettled(
      Array.from({ length: buyers }, async (_, i) => {
        const s = await press(i + 1, [line("walk", 3)]);
        if (s.status === "PAYMENT_REDIRECT")
          return confirm.execute(s.reference);
        return s;
      }),
    );
    const [{ units }] = await client<{ units: number }[]>`
      SELECT coalesce(sum(units), 0)::int AS units FROM bookings`;
    expect(units).toBeLessThanOrEqual(8);
    expect(units).toBe(6);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
  });
});
