import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
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
import { catalogueEditSchema } from "../src/modules/catalogue/domain/catalogue";
import { lagosToday } from "../src/modules/catalogue/domain/events";
import {
  addDays,
  nextRunDates,
  startTimesOn,
} from "../src/modules/catalogue/domain/schedule";
import type { CartLine } from "../src/modules/bookings/domain/cart";
import type { Bookable } from "../src/modules/bookings/domain/resolve-line";
import { canView, type Viewer } from "../src/modules/bookings/domain/checkout";
import type {
  PaymentGateway,
  VerifiedPayment,
} from "../src/modules/bookings/application/ports/payment-gateway";
import { CartPricing } from "../src/modules/bookings/application/services/cart-pricing";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import { StartCheckout } from "../src/modules/bookings/application/use-cases/start-checkout";
import {
  ConfirmOwnPayment,
  ConfirmPayment,
} from "../src/modules/bookings/application/use-cases/confirm-payment";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import type {
  EmailMessage,
  Mailer,
} from "../src/modules/bookings/application/ports/mailer";
import { OrderLinks } from "../src/modules/bookings/application/services/order-links";
import { SendOrderReceipt } from "../src/modules/bookings/application/use-cases/order-receipt";
import { GetOrder } from "../src/modules/bookings/application/use-cases/orders";
import { orderPaidEmail } from "../src/modules/bookings/domain/order-email";
import { ReceiptNotifier } from "../src/modules/bookings/infrastructure/notifications/receipt-notifier";
import {
  guestKeyFromCookies,
  guestKeyHash,
} from "../src/modules/bookings/presentation/http/guest-key";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const checkouts = new DrizzleCheckoutRepository(() => db);
const today = lagosToday();

// The same walk sold three ways: as a guest-checkout event, as an event that
// needs an account, and as an everyday activity.
function variant(offerId: string, event?: Experience["event"]) {
  const record = fixture.experiences.find(
    (e) => e.id === "nature-walk",
  ) as Experience;
  return toPublishedExperience({
    id: randomUUID(),
    seedKey: offerId,
    record: { ...record, offer: { ...record.offer, id: offerId }, event },
  });
}
const gig = variant("offer-gig", { type: "CONCERT", guestCheckout: true });
const members = variant("offer-members", { type: "CONCERT" });
const walk = variant("offer-walk");
const bookables: Bookable[] = [gig, members, walk].map((listing) => ({
  kind: "EXPERIENCE",
  productId: listing.id,
  partnerId: null,
  listing,
}));
const pricing = new CartPricing({ load: async () => bookables }, checkouts);
const date = nextRunDates(walk, addDays(today, 3), 1)[0];

function line(offerId: string): CartLine {
  return {
    kind: "EXPERIENCE",
    id: randomUUID(),
    offerId,
    date,
    time: startTimesOn(walk, date)[0],
    adults: 2,
    children: 0,
    childAges: [],
    pickup: false,
    pickupAddress: "",
  };
}

class FakeGateway implements PaymentGateway {
  readonly provider = "FAKE";
  emails = new Map<string, string>();
  paid = new Set<string>();
  amounts = new Map<string, number>();
  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    this.emails.set(input.reference, input.email);
    this.amounts.set(input.reference, input.amountMinor);
    return {
      authorizationUrl: `https://pay.test/${input.reference}`,
      accessCode: null,
    };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    return {
      status: this.paid.has(reference) ? "SUCCESS" : "PENDING",
      amountMinor: this.amounts.get(reference) ?? 0,
      currency: "NGN",
      channel: "card",
      paidAt: new Date(),
      payload: {},
    };
  }
}

let gateway: FakeGateway;
let start: StartCheckout;
let confirm: ConfirmPayment;
const paidNotes: { userId: string | null; email: string }[] = [];

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  await pg.query(
    "INSERT INTO auth_user (id, name, email) VALUES ('u1', 'u1', 'u1@example.com')",
  );
});

beforeEach(async () => {
  await pg.exec(
    "TRUNCATE service_request_history, service_requests, booking_status_history, bookings, orders, payments, payment_events, checkout_lines, checkouts, inventory_slots, account_carts",
  );
  gateway = new FakeGateway();
  start = new StartCheckout(
    pricing,
    checkouts,
    new PaymentStarter(
      checkouts,
      () => gateway,
      () => "http://app.test/checkout/return",
    ),
  );
  confirm = new ConfirmPayment(checkouts, () => gateway, {
    async orderPaid(e) {
      paidNotes.push(e);
    },
    async needsReview() {},
    async serviceUpdated() {},
  });
});

const browserA = guestKeyHash("a".repeat(43))!;
const browserB = guestKeyHash("b".repeat(43))!;
const guestIn = (hash: string): Viewer => ({
  userId: null,
  guestKeyHash: hash,
});

async function guestPay(
  lines: CartLine[],
  hash = browserA,
  key = randomUUID(),
) {
  const { quote } = await pricing.price(lines, new Date());
  return start.execute({
    user: { id: null, email: "ada@example.com", guestKeyHash: hash },
    idempotencyKey: key,
    input: {
      lines,
      shownTotalMinor: quote.totals.totalMinor,
      contact: { name: "Ada Guest", phone: "+234 801 234 5678" },
      agreed: true,
    },
  });
}
const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof AppError ? e : Promise.reject(e)),
  );

describe("guest checkout", () => {
  it("lets partners switch it on per event", () => {
    const edit = (event: unknown) =>
      catalogueEditSchema.shape.event.safeParse(event).success;
    expect(edit({ type: "CONCERT", guestCheckout: true })).toBe(true);
    expect(edit({ type: "CONCERT", guestCheckout: "yes" })).toBe(false);
  });

  it("sells guest-checkout event tickets without an account", async () => {
    const started = await guestPay([line("offer-gig")]);
    expect(started.status).toBe("PAYMENT_REDIRECT");
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    // Paystack gets the guest's own email.
    expect(gateway.emails.get(reference)).toBe("ada@example.com");

    gateway.paid.add(reference);
    const paid = await confirm.execute(reference);
    expect(paid.status).toBe("PAID");
    expect(paidNotes.at(-1)).toEqual(
      expect.objectContaining({ userId: null, email: "ada@example.com" }),
    );
    const orderRef = paid.status === "PAID" ? paid.orderReference : "";

    // Only the browser that paid sees the order, even after signing in.
    const order = await checkouts.findOrder(guestIn(browserA), orderRef);
    expect(order?.contact.email).toBe("ada@example.com");
    expect(order?.bookings).toHaveLength(1);
    expect(await checkouts.findOrder(guestIn(browserB), orderRef)).toBeNull();
    expect(
      await checkouts.findOrder({ userId: "u1", guestKeyHash: null }, orderRef),
    ).toBeNull();
    expect(
      await checkouts.listOrders({ userId: "u1", guestKeyHash: browserA }),
    ).toHaveLength(1);
  });

  it("asks for an account unless every item allows guests", async () => {
    for (const lines of [
      [line("offer-members")],
      [line("offer-walk")],
      [line("offer-gig"), line("offer-walk")],
    ])
      expect((await refusal(guestPay(lines)))?.code).toBe("SIGN_IN_REQUIRED");
    const noKey = await refusal(
      start.execute({
        user: { id: null, email: "ada@example.com" },
        idempotencyKey: randomUUID(),
        input: {
          lines: [line("offer-gig")],
          shownTotalMinor: 1,
          contact: { name: "Ada Guest", phone: "+234 801 234 5678" },
          agreed: true,
        },
      }),
    );
    expect(noKey?.code).toBe("SIGN_IN_REQUIRED");
  });

  it("keeps a guest's Pay press to the browser that made it", async () => {
    const key = randomUUID();
    const lines = [line("offer-gig")];
    const first = await guestPay(lines, browserA, key);
    expect(await guestPay(lines, browserA, key)).toEqual(first);
    expect((await refusal(guestPay(lines, browserB, key)))?.code).toBe(
      "IDEMPOTENCY_KEY_REUSED",
    );

    const reference =
      first.status === "PAYMENT_REDIRECT" ? first.reference : "";
    const own = new ConfirmOwnPayment(checkouts, confirm);
    expect((await own.execute(guestIn(browserA), reference)).status).toBe(
      "PENDING",
    );
    expect(
      (await refusal(own.execute(guestIn(browserB), reference)))?.code,
    ).toBe("NOT_FOUND");
  });

  it("releases a guest's earlier hold when they press Pay again", async () => {
    await guestPay([line("offer-gig")]);
    await guestPay([line("offer-gig")]);
    const { rows } = await pg.query<{ open: number }>(
      "SELECT count(*)::int AS open FROM checkouts WHERE expires_at > now()",
    );
    expect(rows[0].open).toBe(1);
  });
});

describe("guest key", () => {
  it("reads the cookie and never stores the key itself", () => {
    const key = "k".repeat(43);
    expect(guestKeyFromCookies(`a=1; fl_guest=${key}; b=2`)).toBe(key);
    expect(guestKeyFromCookies("a=1")).toBeNull();
    expect(guestKeyHash(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(guestKeyHash("short")).toBeNull();
    expect(guestKeyHash("x".repeat(40) + "<>")).toBeNull();
  });

  it("gives account orders to the account and guest orders to the browser", () => {
    const account = { userId: "u1", guestKeyHash: null };
    const guest = { userId: null, guestKeyHash: browserA };
    expect(canView(account, { userId: "u1", guestKeyHash: browserA })).toBe(
      true,
    );
    expect(canView(account, guestIn(browserA))).toBe(false);
    expect(canView(guest, { userId: "u1", guestKeyHash: browserA })).toBe(true);
    expect(canView(guest, { userId: "u1", guestKeyHash: null })).toBe(false);
    expect(
      canView({ userId: null, guestKeyHash: null }, guestIn(browserA)),
    ).toBe(false);
  });
});

describe("confirmation email", () => {
  const links = new OrderLinks(
    () => "test-secret",
    () => "http://app.test",
  );
  const sent: EmailMessage[] = [];
  let failing = false;
  const mailer: Mailer = {
    async send(message) {
      if (failing) throw new Error("provider down");
      sent.push(message);
    },
  };
  const receiptConfirm = () =>
    new ConfirmPayment(
      checkouts,
      () => gateway,
      new ReceiptNotifier(
        {
          async orderPaid() {},
          async needsReview() {},
          async serviceUpdated() {},
        },
        new SendOrderReceipt(checkouts, () => mailer, links),
      ),
    );
  const noExpiry = {
    execute: async () => 0,
  } as unknown as ConstructorParameters<typeof GetOrder>[1];

  beforeEach(() => {
    sent.length = 0;
    failing = false;
  });

  async function paidGuestOrder() {
    const started = await guestPay([line("offer-gig")]);
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    gateway.paid.add(reference);
    return { reference, confirm: receiptConfirm() };
  }

  it("emails the guest their tickets once, with a link that opens anywhere", async () => {
    const { reference, confirm: withEmail } = await paidGuestOrder();
    const paid = await withEmail.execute(reference);
    // The webhook and the return page both confirm; still one email.
    await withEmail.execute(reference);
    const orderRef = paid.status === "PAID" ? paid.orderReference : "";
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email.to).toBe("ada@example.com");
    expect(email.subject).toContain(orderRef);
    expect(email.text).toContain("Hi Ada Guest");
    expect(email.text).toContain(
      "Show this email or the reference at the door.",
    );
    expect(email.html).toContain(orderRef);

    const link = links.url(orderRef);
    expect(email.text).toContain(link);
    const key = new URL(link).searchParams.get("k")!;
    const orders = new GetOrder(checkouts, noExpiry, links);
    expect((await orders.withLink(orderRef, key)).contact.email).toBe(
      "ada@example.com",
    );
    for (const wrong of [undefined, "", key.slice(1), links.key("FL-OTHER")])
      expect((await refusal(orders.withLink(orderRef, wrong)))?.code).toBe(
        "NOT_FOUND",
      );
  });

  it("says booked, waiting for the partner, until they confirm", () => {
    const base = {
      reference: "FL-TEST22",
      tripId: null,
      createdAt: new Date().toISOString(),
      totalMinor: 500000,
      contact: { name: "Ada", email: "ada@example.com", phone: "+234" },
      services: [],
    };
    const booking = {
      id: "b1",
      cartLineId: "l1",
      title: "Rooftop concert",
      productType: "EXPERIENCE" as const,
      date,
      startTime: "19:00",
      partnerDeadline: new Date(Date.now() + 86400000).toISOString(),
      totalMinor: 500000,
      feeMinor: 0,
      rows: [],
      terms: {
        operator: "Lagos Live",
        where: "Make your own way · Rooftop",
        confirmation: "PARTNER" as const,
        partnerHours: 24,
        freeCancellationHours: null,
        cancellation: "No refunds",
      },
      line: line("offer-gig"),
    };
    const waiting = orderPaidEmail(
      { ...base, bookings: [{ ...booking, status: "AWAITING_PARTNER" }] },
      "http://app.test/x",
    );
    expect(waiting.subject).toBe("Booked: FL-TEST22, waiting for confirmation");
    expect(waiting.text).toContain(
      "Booked, waiting for Lagos Live to confirm by",
    );
    expect(waiting.text).toContain("isn’t final until then");
    const done = orderPaidEmail(
      { ...base, bookings: [{ ...booking, status: "CONFIRMED" }] },
      "http://app.test/x",
    );
    expect(done.subject).toBe("You’re booked: FL-TEST22");
    expect(done.text).not.toContain("waiting");
    // Names typed at checkout can't inject markup.
    expect(
      orderPaidEmail(
        {
          ...base,
          contact: { ...base.contact, name: "<b>x</b>" },
          bookings: [{ ...booking, status: "CONFIRMED" }],
        },
        "http://app.test/x",
      ).html,
    ).not.toContain("<b>x</b>");
  });

  it("still books when the email can't be sent", async () => {
    failing = true;
    const { reference, confirm: withEmail } = await paidGuestOrder();
    expect((await withEmail.execute(reference)).status).toBe("PAID");
    expect(sent).toHaveLength(0);
  });
});
