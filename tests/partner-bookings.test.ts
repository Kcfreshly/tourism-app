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
import { lagosToday } from "../src/modules/catalogue/domain/events";
import {
  addDays,
  nextRunDates,
  startTimesOn,
} from "../src/modules/catalogue/domain/schedule";
import type { CartLine } from "../src/modules/bookings/domain/cart";
import type { Bookable } from "../src/modules/bookings/domain/resolve-line";
import type { PartnerBookingView } from "../src/modules/bookings/domain/partner-booking";
import { bookingDecidedEmail } from "../src/modules/bookings/domain/order-email";
import type {
  PaymentGateway,
  VerifiedPayment,
} from "../src/modules/bookings/application/ports/payment-gateway";
import type { Notifier } from "../src/modules/bookings/application/ports/notifier";
import { CartPricing } from "../src/modules/bookings/application/services/cart-pricing";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import { StartCheckout } from "../src/modules/bookings/application/use-cases/start-checkout";
import { ConfirmPayment } from "../src/modules/bookings/application/use-cases/confirm-payment";
import {
  DecideBooking,
  ExpireUnconfirmedBookings,
  ListPartnerBookings,
} from "../src/modules/bookings/application/use-cases/partner-bookings";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import { DrizzlePartnerBookingRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-partner-booking-repository";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const checkouts = new DrizzleCheckoutRepository(() => db);
const repo = new DrizzlePartnerBookingRepository(() => db);
const today = lagosToday();
const partnerId = randomUUID();
const otherPartner = randomUUID();

// A partner-run activity that needs the partner to confirm within 24 h.
const record = fixture.experiences.find(
  (e) => e.id === "nature-walk",
) as Experience;
const listing = toPublishedExperience({
  id: randomUUID(),
  seedKey: "offer-kayak",
  record: {
    ...record,
    name: "Lagoon kayak morning",
    offer: { ...record.offer, id: "offer-kayak", capacityPerSlot: 4 },
    details: {
      operator: "Lagoon Paddlers",
      venue: "Jetty 3, Lekki Phase 1",
      arrival: "SELF",
      pickupRateMinor: 0,
      childRateMinor: 0,
      confirmation: "PARTNER",
      partnerHours: 24,
      freeCancellationHours: 48,
    },
  },
});
const bookables: Bookable[] = [
  { kind: "EXPERIENCE", productId: listing.id, partnerId, listing },
];
const pricing = new CartPricing({ load: async () => bookables }, checkouts);
// Each booking gets its own run date, so tests don't share places.
const dates = nextRunDates(listing, addDays(today, 5), 10);
let nextDate = 0;

function line(adults: number, date: string): CartLine {
  return {
    kind: "EXPERIENCE",
    id: randomUUID(),
    offerId: "offer-kayak",
    date,
    time: startTimesOn(listing, date)[0],
    adults,
    children: 0,
    childAges: [],
    pickup: false,
    pickupAddress: "",
  };
}

const amounts = new Map<string, number>();
const gateway: PaymentGateway = {
  provider: "FAKE",
  async initialize(input) {
    amounts.set(input.reference, input.amountMinor);
    return { authorizationUrl: "https://pay.test", accessCode: null };
  },
  async verify(reference): Promise<VerifiedPayment> {
    return {
      status: "SUCCESS",
      amountMinor: amounts.get(reference) ?? 0,
      currency: "NGN",
      channel: "card",
      paidAt: new Date(),
      payload: {},
    };
  },
};

const told: PartnerBookingView[] = [];
const notifier: Notifier = {
  orderPaid: async () => {},
  needsReview: async () => {},
  serviceUpdated: async () => {},
  bookingDecided: async (b) => {
    told.push(b);
  },
  stayOffered: async () => {},
};
const start = new StartCheckout(
  pricing,
  checkouts,
  new PaymentStarter(
    checkouts,
    () => gateway,
    () => "http://app.test/r",
  ),
);
const confirm = new ConfirmPayment(checkouts, () => gateway, notifier);

async function paidBooking(adults = 2, date = dates[nextDate++]) {
  const lines = [line(adults, date)];
  const { quote } = await pricing.price(lines, new Date());
  const started = await start.execute({
    user: { id: "u1", email: "ada@example.com" },
    idempotencyKey: randomUUID(),
    input: {
      lines,
      shownTotalMinor: quote.totals.totalMinor,
      contact: { name: "Ada Obi", phone: "+234 801 234 5678" },
      agreed: true,
    },
  });
  if (started.status !== "PAYMENT_REDIRECT") throw Error(started.status);
  const paid = await confirm.execute(started.reference);
  if (paid.status !== "PAID") throw Error(paid.status);
  const [booking] = (await repo.listForPartner(partnerId)).filter(
    (b) => b.orderReference === paid.orderReference,
  );
  return booking;
}

const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof AppError ? e : Promise.reject(e)),
  );

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  await pg.query(
    "INSERT INTO auth_user (id, name, email) VALUES ('u1', 'Ada', 'ada@example.com')",
  );
  for (const [id, name] of [
    [partnerId, "Lagoon Paddlers"],
    [otherPartner, "Someone Else"],
  ])
    await pg.query(
      "INSERT INTO partners (id, business_name, contact_email, phone, offering, status) VALUES ($1, $2, 'p@example.com', '+234 800 000 0000', 'Kayak trips on the lagoon', 'VERIFIED')",
      [id, name],
    );
});

beforeEach(() => {
  told.length = 0;
});

describe("partners confirm or decline paid bookings", () => {
  const expire = new ExpireUnconfirmedBookings(repo, notifier);
  const decide = new DecideBooking(repo, notifier, expire);
  const partner = (id = partnerId) =>
    ({ type: "PARTNER", id: "partner-user", partnerId: id }) as const;

  it("shows the partner what was paid, who is coming and their share", async () => {
    const b = await paidBooking();
    expect(b).toMatchObject({
      status: "AWAITING_PARTNER",
      businessName: "Lagoon Paddlers",
      title: "Lagoon kayak morning",
      guest: { name: "Ada Obi", phone: "+234 801 234 5678" },
      commissionBps: 1500,
    });
    expect(b.partnerDeadline).not.toBeNull();
    // The price before the service fee, less 15%.
    expect(b.partnerShareMinor).toBeGreaterThan(0);
    expect(b.partnerShareMinor).toBeLessThan(b.totalMinor);
  });

  it("confirms, tells the traveller, and the order says confirmed", async () => {
    const b = await paidBooking();
    const done = await decide.execute(partner(), {
      action: "CONFIRM",
      id: b.id,
      expectedVersion: b.version,
    });
    expect(done.status).toBe("CONFIRMED");
    expect(told.map((t) => t.status)).toEqual(["CONFIRMED"]);
    const order = await checkouts.findOrderByReference(b.orderReference);
    expect(order?.bookings[0].status).toBe("CONFIRMED");
    // Once answered, it can't be answered again.
    const again = await refusal(
      decide.execute(partner(), {
        action: "DECLINE",
        id: b.id,
        expectedVersion: done.version,
        reason: "Changed our mind",
      }),
    );
    expect(again?.code).toBe("INVALID_TRANSITION");
  });

  it("declines with a reason and puts the places back on sale", async () => {
    // Four places: a booking of four fills the slot.
    const date = dates[nextDate++];
    const b = await paidBooking(4, date);
    const full = await pricing.price([line(1, date)], new Date());
    expect(full.quote.lines[0].problem).toBeTruthy();

    const done = await decide.execute(partner(), {
      action: "DECLINE",
      id: b.id,
      expectedVersion: b.version,
      reason: "The boat is out of service that day",
    });
    expect(done).toMatchObject({
      status: "DECLINED",
      reason: "The boat is out of service that day",
    });
    const reopened = await pricing.price([line(1, date)], new Date());
    expect(reopened.quote.lines[0].problem).toBeFalsy();

    const email = bookingDecidedEmail(done, "http://app.test/b");
    expect(email.to).toBe("ada@example.com");
    expect(email.subject).toContain("full refund");
    expect(email.text).toContain("The boat is out of service that day");
  });

  it("only lets a partner answer its own bookings, with a fresh version", async () => {
    const b = await paidBooking();
    const other = await refusal(
      decide.execute(partner(otherPartner), {
        action: "CONFIRM",
        id: b.id,
        expectedVersion: b.version,
      }),
    );
    expect(other?.code).toBe("NOT_FOUND");
    expect(await repo.listForPartner(otherPartner)).toHaveLength(0);
    const stale = await refusal(
      decide.execute(partner(), {
        action: "CONFIRM",
        id: b.id,
        expectedVersion: b.version + 1,
      }),
    );
    expect(stale?.code).toBe("VERSION_CONFLICT");
    // Staff can answer on the partner's behalf.
    const staffDone = await decide.execute(
      { type: "STAFF", id: "staff-1" },
      { action: "CONFIRM", id: b.id, expectedVersion: b.version },
    );
    expect(staffDone.status).toBe("CONFIRMED");
  });

  it("declines bookings nobody answered by the deadline", async () => {
    const b = await paidBooking();
    const later = () => new Date(Date.parse(b.partnerDeadline!) + 60000);
    const lateExpire = new ExpireUnconfirmedBookings(repo, notifier, later);
    const list = new ListPartnerBookings(repo, lateExpire);
    const after = (await list.forPartner(partnerId)).find((x) => x.id === b.id);
    expect(after).toMatchObject({
      status: "DECLINED",
      reason: expect.stringContaining("in time"),
    });
    expect(told.some((t) => t.id === b.id && t.status === "DECLINED")).toBe(
      true,
    );
    // Staff see it as a refund due.
    expect((await list.forStaff()).find((x) => x.id === b.id)?.status).toBe(
      "DECLINED",
    );
    // A late confirm is refused.
    const late = await refusal(
      new DecideBooking(repo, notifier, lateExpire).execute(partner(), {
        action: "CONFIRM",
        id: b.id,
        expectedVersion: after!.version,
      }),
    );
    expect(late?.code).toBe("INVALID_TRANSITION");
  });
});
