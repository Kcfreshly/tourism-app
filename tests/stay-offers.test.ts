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
import { addDays } from "../src/modules/catalogue/domain/schedule";
import {
  assess,
  type Item,
  type Services,
} from "../src/modules/trips/domain/planner";
import { initialProfile } from "../src/modules/trips/domain/profile";
import type { Bookable } from "../src/modules/bookings/domain/resolve-line";
import {
  nights,
  stayOpen,
  stayStatusLabel,
} from "../src/modules/bookings/domain/stay-offer";
import type {
  PaymentGateway,
  VerifiedPayment,
} from "../src/modules/bookings/application/ports/payment-gateway";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import { StartTripCheckout } from "../src/modules/bookings/application/use-cases/start-trip-checkout";
import { ConfirmPayment } from "../src/modules/bookings/application/use-cases/confirm-payment";
import {
  ApproveStay,
  ListStayOrders,
  SendStayOfferToTrip,
  WithdrawStayOffer,
} from "../src/modules/bookings/application/use-cases/stay-offers";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import { DrizzleStayOfferRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-stay-offer-repository";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const checkouts = new DrizzleCheckoutRepository(() => db);
const stays = new DrizzleStayOfferRepository(() => db);

const offers = fixture.experiences.map((e) =>
  toPublishedExperience({ id: e.id, seedKey: e.id, record: e as Experience }),
);
const bookables: Bookable[] = offers.map((listing) => ({
  kind: "EXPERIENCE",
  productId: randomUUID(),
  partnerId: null,
  listing,
}));
const day = addDays(lagosToday(), 10);

// A paid two-day trip: a walk with a car for the day.
function plannedTrip() {
  const profile = {
    ...initialProfile,
    startDate: day,
    endDate: addDays(day, 1),
    zoneId: "LEKKI" as const,
    accommodation: "",
    accommodationBy: "FASTLIFE" as const,
  };
  const items: Item[] = [
    {
      id: randomUUID(),
      localDate: day,
      startTime: "10:00",
      endTime: "12:00",
      kind: "EXPERIENCE",
      offerId: "offer-nature-walk",
      title: "Nature walk",
      locked: false,
    },
  ];
  const services: Services = {
    assistance: "DRIVER_ONLY",
    vehicleWindows: { [day]: { startTime: "09:00", hours: 8 } },
    guideItemIds: [],
    guideDays: [],
  };
  const price = assess(profile, items, services, offers);
  return { id: randomUUID(), version: 1, profile, items, services, price };
}

class FakeGateway implements PaymentGateway {
  readonly provider = "FAKE";
  amounts = new Map<string, number>();
  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
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

let gateway: FakeGateway;
let starter: PaymentStarter;
let confirm: ConfirmPayment;
let clock: Date;
const traveller = { id: "u1", email: "u1@example.com" };
const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof AppError ? e : Promise.reject(e)),
  );
const reference = (r: { status: string; reference?: string }) =>
  r.status === "PAYMENT_REDIRECT" ? r.reference! : "";

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  for (const id of ["u1", "u2"])
    await pg.query(
      "INSERT INTO auth_user (id, name, email) VALUES ($1, $1, $1 || '@example.com')",
      [id],
    );
});

beforeEach(async () => {
  await pg.exec(
    "TRUNCATE stay_offers, service_request_history, service_requests, booking_status_history, bookings, orders, payments, payment_events, checkout_lines, checkouts, inventory_slots",
  );
  clock = new Date();
  gateway = new FakeGateway();
  starter = new PaymentStarter(
    checkouts,
    () => gateway,
    () => "http://app.test/r",
  );
  confirm = new ConfirmPayment(
    checkouts,
    () => gateway,
    {
      orderPaid: async () => {},
      needsReview: async () => {},
      serviceUpdated: async () => {},
      bookingDecided: async () => {},
    },
    () => clock,
  );
});

// Pays for a trip and returns its order reference.
async function paidTrip() {
  const trip = plannedTrip();
  const start = new StartTripCheckout(
    {
      load: async () => ({
        ...trip,
        blockers: trip.price.blockers,
        orderReference: null,
        pickupOverdue: false,
      }),
    },
    { load: async () => bookables },
    checkouts,
    starter,
  );
  const started = await start.execute({
    user: traveller,
    tripId: trip.id,
    idempotencyKey: randomUUID(),
    input: {
      expectedVersion: trip.version,
      shownTotalMinor: trip.price.totalMinor,
      contact: { name: "Ada Lovelace", phone: "+234 801 234 5678" },
      agreed: true,
    },
  });
  const paid = await confirm.execute(reference(started));
  if (paid.status !== "PAID") throw Error("trip not paid");
  return { orderReference: paid.orderReference, total: trip.price.totalMinor };
}

const offer = (
  orderReference: string,
  name: string,
  priceMinor = 18000000,
) => ({
  orderReference,
  propertyName: name,
  area: "Lekki",
  address: "1 Admiralty Way, Lekki Phase 1",
  room: "Deluxe double",
  checkIn: day,
  checkOut: addDays(day, 2),
  note: "",
  priceMinor,
  availableUntil: new Date(clock.getTime() + 24 * 3600000).toISOString(),
});

describe("stay offers", () => {
  it("describe what the traveller sees", () => {
    const o = {
      status: "OFFERED" as const,
      availableUntil: new Date(Date.now() + 3600000).toISOString(),
      checkIn: "2026-12-04",
      checkOut: "2026-12-06",
    };
    expect(nights(o)).toBe(2);
    expect(stayOpen(o, new Date())).toBe(true);
    expect(stayStatusLabel(o, new Date(Date.now() + 7200000))).toBe(
      "Offer lapsed",
    );
  });

  it("are approved and paid as a second payment on the trip's order", async () => {
    const trip = await paidTrip();
    const send = new SendStayOfferToTrip(stays, () => clock);
    const chosen = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Lagoon Hotel"),
    );
    const other = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Palm Suites", 15000000),
    );

    const [listed] = await new ListStayOrders(stays).execute();
    expect(listed.reference).toBe(trip.orderReference);
    expect(listed.offers).toHaveLength(2);

    const approve = new ApproveStay(stays, checkouts, starter, () => clock);
    const started = await approve.execute({
      user: traveller,
      offerId: chosen.id,
      idempotencyKey: randomUUID(),
    });
    // The offer price, with no extra fee.
    expect(gateway.amounts.get(reference(started))).toBe(18000000);
    const paid = await confirm.execute(reference(started));
    expect(paid).toEqual({
      status: "PAID",
      orderReference: trip.orderReference,
    });

    const [order] = await checkouts.listOrders({
      userId: "u1",
      guestKeyHash: null,
    });
    expect(order.totalMinor).toBe(trip.total + 18000000);
    expect(order.stays.map((s) => [s.propertyName, s.status])).toEqual([
      ["Lagoon Hotel", "BOOKED"],
      ["Palm Suites", "DECLINED"],
    ]);
    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM orders",
    );
    expect(rows[0].n).toBe(1);

    // Once a stay is booked, no more offers or approvals.
    expect(
      (
        await refusal(
          send.execute("staff-1", offer(trip.orderReference, "Third")),
        )
      )?.code,
    ).toBe("STAY_ALREADY_BOOKED");
    expect(
      (
        await refusal(
          approve.execute({
            user: traveller,
            offerId: other.id,
            idempotencyKey: randomUUID(),
          }),
        )
      )?.code,
    ).toBe("STAY_ALREADY_BOOKED");
  });

  it("books only one stay when two are paid at once", async () => {
    const trip = await paidTrip();
    const send = new SendStayOfferToTrip(stays, () => clock);
    const a = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Lagoon Hotel"),
    );
    const b = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Palm Suites"),
    );
    const approve = new ApproveStay(stays, checkouts, starter, () => clock);
    // Two tabs approve different stays before either is paid.
    const first = await approve.execute({
      user: traveller,
      offerId: a.id,
      idempotencyKey: randomUUID(),
    });
    const second = await approve.execute({
      user: traveller,
      offerId: b.id,
      idempotencyKey: randomUUID(),
    });
    const results = await Promise.all([
      confirm.execute(reference(first)),
      confirm.execute(reference(second)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "PAID",
      "REQUIRES_REVIEW",
    ]);
    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM stay_offers WHERE status = 'BOOKED'",
    );
    expect(rows[0].n).toBe(1);
  });

  it("refuses offers that lapsed, were withdrawn, or aren't yours", async () => {
    const trip = await paidTrip();
    const send = new SendStayOfferToTrip(stays, () => clock);
    const approve = new ApproveStay(stays, checkouts, starter, () => clock);
    const lapsing = await send.execute("staff-1", {
      ...offer(trip.orderReference, "Short hold"),
      availableUntil: new Date(clock.getTime() + 60000).toISOString(),
    });
    const later = new ApproveStay(
      stays,
      checkouts,
      starter,
      () => new Date(clock.getTime() + 120000),
    );
    expect(
      (
        await refusal(
          later.execute({
            user: traveller,
            offerId: lapsing.id,
            idempotencyKey: randomUUID(),
          }),
        )
      )?.code,
    ).toBe("OFFER_LAPSED");

    const pulled = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Pulled"),
    );
    await new WithdrawStayOffer(stays).execute("staff-1", {
      id: pulled.id,
      expectedVersion: pulled.version,
    });
    expect(
      (
        await refusal(
          approve.execute({
            user: traveller,
            offerId: pulled.id,
            idempotencyKey: randomUUID(),
          }),
        )
      )?.code,
    ).toBe("OFFER_LAPSED");

    const mine = await send.execute(
      "staff-1",
      offer(trip.orderReference, "Mine"),
    );
    expect(
      (
        await refusal(
          approve.execute({
            user: { id: "u2", email: "u2@example.com" },
            offerId: mine.id,
            idempotencyKey: randomUUID(),
          }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
  });

  it("keeps to three open offers and real trips", async () => {
    const trip = await paidTrip();
    const send = new SendStayOfferToTrip(stays, () => clock);
    for (const name of ["One", "Two", "Three"])
      await send.execute("staff-1", offer(trip.orderReference, name));
    expect(
      (
        await refusal(
          send.execute("staff-1", offer(trip.orderReference, "Four")),
        )
      )?.code,
    ).toBe("TOO_MANY_OFFERS");
    expect(
      (await refusal(send.execute("staff-1", offer("FL-NOPE00", "Lost"))))
        ?.code,
    ).toBe("NOT_FOUND");
  });
});
