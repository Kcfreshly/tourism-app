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
  lagosInstant,
} from "../src/modules/catalogue/domain/schedule";
import {
  assess,
  type Item,
  type PriceLine,
  type Services,
} from "../src/modules/trips/domain/planner";
import { initialProfile } from "../src/modules/trips/domain/profile";
import type { Bookable } from "../src/modules/bookings/domain/resolve-line";
import {
  shareFee,
  tripCheckoutLines,
  type TripForCheckout,
} from "../src/modules/bookings/domain/trip-checkout";
import type { PaymentGateway } from "../src/modules/bookings/application/ports/payment-gateway";
import type { TripSource } from "../src/modules/bookings/application/ports/trip-source";
import { PaymentStarter } from "../src/modules/bookings/application/services/payment-starter";
import { StartTripCheckout } from "../src/modules/bookings/application/use-cases/start-trip-checkout";
import { ConfirmPayment } from "../src/modules/bookings/application/use-cases/confirm-payment";
import { DrizzleCheckoutRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import type {
  TripRepository,
  TripRow,
} from "../src/modules/trips/application/ports/trip-repository";
import type { TripBookings } from "../src/modules/trips/application/ports/trip-bookings";
import { LoadOwnedTrip } from "../src/modules/trips/application/use-cases/load-owned-trip";
import { SaveWorkspace } from "../src/modules/trips/application/use-cases/save-workspace";
import { UpdateTripProfile } from "../src/modules/trips/application/use-cases/update-trip-profile";
import { DeleteTrip } from "../src/modules/trips/application/use-cases/delete-trip";
import { ListTrips } from "../src/modules/trips/application/use-cases/list-trips";
import { OfferSelection } from "../src/modules/trips/application/services/offer-selection";
import { onlyBookedEditsChanged } from "../src/modules/trips/domain/booked-trip";
import { defaultTransportSettings } from "../src/modules/trips/domain/transport-settings";
import { DrizzleServiceRequestRepository } from "../src/modules/bookings/infrastructure/persistence/drizzle-service-request-repository";
import {
  ExpireOverdueServices,
  ListServiceQueue,
  UpdateServiceRequest,
} from "../src/modules/bookings/application/use-cases/service-requests";
import type { Notifier } from "../src/modules/bookings/application/ports/notifier";
import {
  assigneeLines,
  nextServiceStatus,
} from "../src/modules/bookings/domain/service-request";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const checkouts = new DrizzleCheckoutRepository(() => db);

const offers = fixture.experiences.map((e) =>
  toPublishedExperience({
    id: e.id,
    seedKey: e.id,
    record: e as Experience,
  }),
);
const bookables: Bookable[] = offers.map((listing) => ({
  kind: "EXPERIENCE",
  productId: randomUUID(),
  partnerId: null,
  listing,
}));

// A two-day trip: a nature walk with a car for the day and a full-day guide.
function plannedTrip(day: string) {
  const profile = {
    ...initialProfile,
    startDate: day,
    endDate: addDays(day, 1),
    zoneId: "LEKKI" as const,
    accommodation: "Lekki Phase 1",
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
    assistance: "FULL_DAY_GUIDE",
    vehicleWindows: { [day]: { startTime: "09:00", hours: 8 } },
    guideItemIds: [],
    guideDays: [day],
  };
  const price = assess(profile, items, services, offers);
  return { id: randomUUID(), version: 3, profile, items, services, price };
}

class FakeGateway implements PaymentGateway {
  readonly provider = "FAKE";
  amounts = new Map<string, number>();
  paid = new Set<string>();
  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    this.amounts.set(input.reference, input.amountMinor);
    return {
      authorizationUrl: `https://pay.test/${input.reference}`,
      accessCode: null,
    };
  }
  async verify(reference: string) {
    return {
      status: this.paid.has(reference)
        ? ("SUCCESS" as const)
        : ("PENDING" as const),
      amountMinor: this.amounts.get(reference) ?? 0,
      currency: "NGN",
      channel: "card",
      paidAt: new Date(),
      payload: {},
    };
  }
}

let trip: ReturnType<typeof plannedTrip>;
let gateway: FakeGateway;
let start: StartTripCheckout;
let confirm: ConfirmPayment;
// Whether the test trip's pickup address is overdue.
let pickupOverdue = false;
const source: TripSource = {
  load: async () => ({
    ...trip,
    blockers: trip.price.blockers,
    // The real lookup, as the container wires it.
    orderReference:
      (await checkouts.ordersForTrips([trip.id])).get(trip.id) ?? null,
    pickupOverdue,
  }),
};
const contact = { name: "Ada Lovelace", phone: "+234 801 234 5678" };
const user = { id: "u1", email: "u1@example.com" };

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
    "TRUNCATE stay_offers, service_request_history, service_requests, booking_status_history, bookings, orders, payments, payment_events, checkout_lines, checkouts, inventory_slots",
  );
  trip = plannedTrip(addDays(lagosToday(), 10));
  gateway = new FakeGateway();
  start = new StartTripCheckout(
    source,
    { load: async () => bookables },
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
});

const pay = (
  input: Partial<{ expectedVersion: number; shownTotalMinor: number }> = {},
) =>
  start.execute({
    user,
    tripId: trip.id,
    idempotencyKey: randomUUID(),
    input: {
      expectedVersion: trip.version,
      shownTotalMinor: trip.price.totalMinor,
      contact,
      agreed: true,
      ...input,
    },
  });
const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof AppError ? e : Promise.reject(e)),
  );

describe("trip checkout lines", () => {
  it("turns every planner charge into exactly one line", () => {
    expect(trip.price.blockers).toEqual([]);
    const { lines, problems } = tripCheckoutLines(trip, bookables, Date.now());
    expect(problems).toEqual([]);
    expect(
      lines.map((l) =>
        l.line.kind === "SERVICE" ? l.line.service : l.line.kind,
      ),
    ).toEqual(["EXPERIENCE", "CAR", "FULL_DAY_GUIDE"]);
    expect(lines.reduce((n, l) => n + l.subtotalMinor, 0)).toBe(
      trip.price.subtotalMinor,
    );
    expect(lines[0].slot?.units).toBe(trip.profile.adults);
    expect(lines[1].slot).toBeNull();
  });

  it("folds a cross-area surcharge into that day's car", () => {
    const day = addDays(lagosToday(), 10);
    const line = (key: string, totalMinor: number): PriceLine => ({
      key,
      label: `${day} · ${key}`,
      group: "transport",
      quantity: 1,
      unitRateMinor: totalMinor,
      totalMinor,
      rule: "",
    });
    const withSurcharge: TripForCheckout = {
      ...trip,
      price: {
        lines: [
          ...trip.price.lines.filter((l) => l.group === "activities"),
          line(`vehicle:${day}`, 4500000),
          line(`cross-zone:${day}`, 500000),
          line(`mystery:${day}`, 100),
        ],
        subtotalMinor: 0,
        feeMinor: 0,
        totalMinor: 0,
      },
    };
    const { lines, problems } = tripCheckoutLines(
      withSurcharge,
      bookables,
      Date.now(),
    );
    const car = lines.find((l) => l.line.kind === "SERVICE")!;
    expect(car.subtotalMinor).toBe(5000000);
    expect(car.rows).toHaveLength(2);
    // An unknown charge is never silently dropped.
    expect(problems.join(" ")).toMatch(/can’t book yet/);
  });

  it("shares the fee so the lines add up to the planner's fee", () => {
    const fees = shareFee([333, 333, 334], 100);
    expect(fees.reduce((n, f) => n + f, 0)).toBe(100);
  });

  it("needs 48 hours' notice for drivers and guides", () => {
    const soon = plannedTrip(addDays(lagosToday(), 1));
    const { problems } = tripCheckoutLines(soon, bookables, Date.now());
    expect(problems.join(" ")).toMatch(/48 hours’ notice/);
  });
});

describe("paying for a trip", () => {
  it("takes one payment and asks staff to match the driver and guide", async () => {
    const started = await pay();
    expect(started.status).toBe("PAYMENT_REDIRECT");
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    expect(gateway.amounts.get(reference)).toBe(trip.price.totalMinor);
    gateway.paid.add(reference);
    expect((await confirm.execute(reference)).status).toBe("PAID");

    const [order] = await checkouts.listOrders({
      userId: "u1",
      guestKeyHash: null,
    });
    expect(order.tripId).toBe(trip.id);
    expect(order.totalMinor).toBe(trip.price.totalMinor);
    expect(order.bookings.map((b) => b.status)).toEqual(["CONFIRMED"]);
    expect(order.services.map((s) => [s.service, s.status])).toEqual([
      ["CAR", "REQUESTED"],
      ["FULL_DAY_GUIDE", "REQUESTED"],
    ]);
    const car = order.services[0];
    expect(Date.parse(car.matchBy)).toBe(
      lagosInstant(car.date, "09:00") - 48 * 3600000,
    );
    const paid = [...order.bookings, ...order.services];
    expect(paid.reduce((n, l) => n + l.feeMinor, 0)).toBe(trip.price.feeMinor);
    expect(paid.reduce((n, l) => n + l.totalMinor, 0)).toBe(
      trip.price.totalMinor,
    );
  });

  it("refuses a trip that changed, a stale total or a trip with blockers", async () => {
    expect((await refusal(pay({ expectedVersion: 2 })))?.code).toBe(
      "TRIP_CHANGED",
    );
    expect((await refusal(pay({ shownTotalMinor: 1 })))?.code).toBe(
      "PRICE_CHANGED",
    );
    trip.price = {
      ...trip.price,
      blockers: [{ code: "X", message: "Fix this" }],
    };
    expect((await refusal(pay()))?.code).toBe("TRIP_NOT_READY");
  });

  // The planner's own notice rule may refuse first; either way, no payment.
  it("refuses cars and guides that can't be matched in time", async () => {
    trip = plannedTrip(addDays(lagosToday(), 1));
    const refused = await refusal(pay());
    expect(refused?.code).toBe("TRIP_NOT_READY");
  });
});

describe("matching drivers and guides", () => {
  const services = new DrizzleServiceRequestRepository(() => db);
  const told: string[] = [];
  const notifier: Notifier = {
    orderPaid: async () => {},
    needsReview: async () => {},
    serviceUpdated: async (e) => {
      told.push(`${e.service} ${e.status}`);
    },
    bookingDecided: async () => {},
  };
  const update = new UpdateServiceRequest(services, notifier);
  const driver = {
    name: "Tunde Bakare",
    phone: "+234 802 000 1111",
    vehicle: "Toyota Sienna",
    plate: "LND 123 AB",
  };

  async function paidTrip() {
    const started = await pay();
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    gateway.paid.add(reference);
    await confirm.execute(reference);
    return services.listQueue();
  }

  it("allows only sensible status changes", () => {
    expect(nextServiceStatus("REQUESTED", "MATCH")).toBe("MATCHED");
    expect(nextServiceStatus("MATCHED", "MATCH")).toBe("MATCHED");
    expect(nextServiceStatus("REQUESTED", "COMPLETE")).toBeNull();
    expect(nextServiceStatus("UNMATCHED", "MATCH")).toBeNull();
    expect(assigneeLines("CAR", driver)).toEqual([
      ["Driver", "Tunde Bakare"],
      ["Phone", "+234 802 000 1111"],
      ["Vehicle", "Toyota Sienna"],
      ["Plate", "LND 123 AB"],
    ]);
  });

  it("matches a driver, shows them on the booking and tells the traveller", async () => {
    told.length = 0;
    const queue = await paidTrip();
    const car = queue.find((q) => q.service === "CAR")!;
    expect(car.contact.name).toBe("Ada Lovelace");

    const noPlate = await refusal(
      update.execute("staff-1", {
        action: "MATCH",
        id: car.id,
        expectedVersion: car.version,
        assignee: { ...driver, plate: "" },
      }),
    );
    expect(noPlate?.code).toBe("INVALID_ASSIGNEE");

    const matched = await update.execute("staff-1", {
      action: "MATCH",
      id: car.id,
      expectedVersion: car.version,
      assignee: driver,
    });
    expect(matched.status).toBe("MATCHED");
    expect(told).toEqual(["CAR MATCHED"]);
    // Two staff editing at once: the second is refused.
    const stale = await refusal(
      update.execute("staff-2", {
        action: "COMPLETE",
        id: car.id,
        expectedVersion: car.version,
      }),
    );
    expect(stale?.code).toBe("VERSION_CONFLICT");

    const [order] = await checkouts.listOrders({
      userId: "u1",
      guestKeyHash: null,
    });
    const shown = order.services.find((s) => s.service === "CAR")!;
    expect(shown.status).toBe("MATCHED");
    expect(shown.assignee).toMatchObject({ name: "Tunde Bakare" });
    const { rows } = await pg.query(
      "SELECT from_status, to_status, actor_type FROM service_request_history WHERE service_request_id = $1 ORDER BY created_at",
      [car.id],
    );
    expect(rows).toEqual([
      { from_status: null, to_status: "REQUESTED", actor_type: "SYSTEM" },
      { from_status: "REQUESTED", to_status: "MATCHED", actor_type: "STAFF" },
    ]);
  });

  it("marks a request nobody matched in time as refund due", async () => {
    told.length = 0;
    const queue = await paidTrip();
    // Ten days later the 48-hour deadline has passed.
    const later = new Date(Date.now() + 10 * 86400000);
    const expire = new ExpireOverdueServices(services, notifier, () => later);
    const list = new ListServiceQueue(services, expire);
    const after = await list.execute();
    expect(after.map((q) => q.status)).toEqual(["UNMATCHED", "UNMATCHED"]);
    expect(told.sort()).toEqual(["CAR UNMATCHED", "FULL_DAY_GUIDE UNMATCHED"]);
    // A second read changes nothing.
    await list.execute();
    expect(told).toHaveLength(2);
    const refused = await refusal(
      update.execute("staff-1", {
        action: "MATCH",
        id: queue[0].id,
        expectedVersion: after[0].version,
        assignee: driver,
      }),
    );
    expect(refused?.code).toBe("INVALID_TRANSITION");
  });

  it("lets staff give up on a request with a reason", async () => {
    const [guide] = (await paidTrip()).filter(
      (q) => q.service === "FULL_DAY_GUIDE",
    );
    const done = await update.execute("staff-1", {
      action: "UNMATCH",
      id: guide.id,
      expectedVersion: guide.version,
      note: "No guide free that day",
    });
    expect(done.status).toBe("UNMATCHED");
  });
});

describe("a paid trip", () => {
  const owner = { id: "u1", kind: "ACCOUNT" };
  // One stored trip, enough for the trips use cases.
  function tripStore() {
    let row: TripRow | null = {
      id: trip.id,
      ownerId: "u1",
      ownerType: "ACCOUNT",
      version: trip.version,
      profile: trip.profile,
      items: trip.items,
      services: trip.services,
      updatedAt: new Date(),
    };
    return {
      listOwned: async () => (row ? [row] : []),
      findOwned: async () => row,
      create: async () => row!,
      update: async (_id, _owner, expected, changes) => {
        if (!row || row.version !== expected) return null;
        row = { ...row, ...changes, version: row.version + 1 };
        return row;
      },
      deleteOwned: async () => {
        const had = !!row;
        row = null;
        return had;
      },
    } as TripRepository;
  }
  const bookingsOf: TripBookings = {
    orderFor: async (id) =>
      (await checkouts.ordersForTrips([id])).get(id) ?? null,
    ordersFor: (ids) => checkouts.ordersForTrips(ids),
  };
  const offerCatalogue = { listPublished: async () => offers };
  const transport = {
    get: async () => ({ settings: defaultTransportSettings, version: 1 }),
    save: async () => null,
  };

  async function payTrip() {
    const started = await pay();
    const reference =
      started.status === "PAYMENT_REDIRECT" ? started.reference : "";
    gateway.paid.add(reference);
    const paid = await confirm.execute(reference);
    return paid.status === "PAID" ? paid.orderReference : "";
  }

  it("can't be paid for twice", async () => {
    const reference = await payTrip();
    expect(await pay()).toEqual({ status: "PAID", orderReference: reference });
    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM payments",
    );
    expect(rows[0].n).toBe(1);
  });

  it("refuses a car booked when its pickup address is overdue", async () => {
    pickupOverdue = true;
    try {
      const refused = await refusal(pay());
      expect(refused?.code).toBe("TRIP_NOT_READY");
      expect(refused?.message).toMatch(/pickup address/);
    } finally {
      pickupOverdue = false;
    }
  });

  it("keeps its plan but lets the pickup address change", async () => {
    const reference = await payTrip();
    const trips = tripStore();
    const context = await new LoadOwnedTrip(trips, bookingsOf).execute(
      trip.id,
      owner,
    );
    expect(context.booking).toEqual({ orderReference: reference });

    const save = new SaveWorkspace(trips, offerCatalogue, transport as never);
    const refused = await refusal(
      save.execute(context, {
        expectedVersion: trip.version,
        items: [],
        services: trip.services,
      }),
    );
    expect(refused?.code).toBe("TRIP_BOOKED");

    const update = new UpdateTripProfile(
      trips,
      offerCatalogue,
      new OfferSelection(offerCatalogue),
      bookingsOf,
    );
    const moreAdults = await refusal(
      update.execute({
        id: trip.id,
        owner,
        expectedVersion: trip.version,
        profile: { ...trip.profile, adults: 3 },
      }),
    );
    expect(moreAdults?.code).toBe("TRIP_BOOKED");
    const address = await update.execute({
      id: trip.id,
      owner,
      expectedVersion: trip.version,
      profile: { ...trip.profile, accommodation: "12 Admiralty Way, Lekki" },
    });
    expect(address.version).toBe(trip.version + 1);

    const removed = await refusal(
      new DeleteTrip(trips, bookingsOf).execute(trip.id, owner),
    );
    expect(removed?.code).toBe("TRIP_BOOKED");
    const [listed] = await new ListTrips(trips, bookingsOf).execute(owner);
    expect(listed.orderReference).toBe(reference);
  });

  it("only treats name, address and notes as safe edits", () => {
    const before = trip.profile;
    expect(
      onlyBookedEditsChanged(before, {
        ...before,
        draftName: "Lagos with Mum",
      }),
    ).toBe(true);
    expect(
      onlyBookedEditsChanged(before, { ...before, endDate: before.startDate }),
    ).toBe(false);
  });
});
