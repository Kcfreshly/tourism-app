import { describe, expect, it } from "vitest";
import type {
  BookingView,
  OrderView,
  ServiceView,
} from "../src/modules/bookings/domain/checkout";
import type { StayView } from "../src/modules/bookings/domain/stay-offer";
import {
  arrangedFor,
  daysUntil,
  fulfilmentRows,
  fulfilmentSettled,
} from "../src/modules/bookings/domain/fulfilment";
import {
  serviceUpdateEmail,
  stayOfferedEmail,
} from "../src/modules/bookings/domain/order-email";

const now = new Date("2027-05-01T12:00:00+01:00");
const driver = {
  name: "Tunde Bakare",
  phone: "+234 801 234 5678",
  vehicle: "Toyota Sienna",
  plate: "LAG 123 AB",
};

const service = (
  service: ServiceView["service"],
  status: ServiceView["status"],
  date = "2027-05-08",
  startTime = "09:00",
): ServiceView => ({
  id: `${service}-${date}`,
  service,
  date,
  startTime,
  label: "Lagos, Murtala Muhammed (LOS)",
  status,
  matchBy: "2027-05-06T08:00:00.000Z",
  assignee: status === "MATCHED" ? driver : null,
  totalMinor: 4_100_000,
  feeMinor: 100_000,
  rows: [],
});

const booking = (status: BookingView["status"]): BookingView => ({
  id: `b-${status}`,
  cartLineId: "c",
  title: "Lekki Conservation walk",
  productType: "EXPERIENCE",
  date: "2027-05-08",
  startTime: "14:00",
  status,
  partnerDeadline: null,
  totalMinor: 2_000_000,
  feeMinor: 0,
  rows: [],
  terms: {
    operator: "Partner",
    where: "Lekki",
    confirmation: "PARTNER",
    partnerHours: 24,
    freeCancellationHours: null,
    cancellation: "",
  },
  line: {
    kind: "EXPERIENCE",
    id: "c",
    offerId: "o",
    date: "2027-05-08",
    time: "14:00",
    adults: 2,
    children: 0,
    childAges: [],
    pickup: false,
    pickupAddress: "",
  },
});

const stay = (status: StayView["status"], id = "s1"): StayView => ({
  id,
  version: 1,
  propertyName: "Fictional Lagoon Hotel",
  area: "Victoria Island",
  address: "1 Fictional Close, Victoria Island",
  room: "Deluxe double",
  checkIn: "2027-05-08",
  checkOut: "2027-05-10",
  note: "",
  priceMinor: 18_000_000,
  availableUntil: "2027-05-03T12:00:00.000Z",
  status,
});

const order = (o: Partial<OrderView>): OrderView => ({
  reference: "FL-ABC123",
  tripId: "t1",
  createdAt: "2027-04-30T10:00:00.000Z",
  totalMinor: 10_000_000,
  contact: { name: "Ada", email: "ada@example.test", phone: "+2348000000" },
  bookings: [],
  services: [],
  stays: [],
  trip: {
    startDate: "2027-05-08",
    endDate: "2027-05-10",
    adults: 2,
    zoneId: "VI",
    accommodationBy: "FASTLIFE",
    stay: { type: "HOTEL", choice: { kind: "RECOMMEND" } },
    airportPickup: {
      airport: "LOS",
      flight: "BA75",
      landingDate: "2027-05-08",
      landingTime: "06:10",
      travellers: 2,
      bags: 3,
    },
  },
  ...o,
});

describe("fulfilment tracker", () => {
  it("shows one row per thing we're arranging, with payment first", () => {
    const rows = fulfilmentRows(
      order({
        services: [
          service("AIRPORT_PICKUP", "REQUESTED"),
          service("CAR", "MATCHED"),
          service("FULL_DAY_GUIDE", "REQUESTED"),
        ],
        bookings: [booking("AWAITING_PARTNER")],
      }),
      now,
    );
    expect(rows.map((r) => [r.key, r.status])).toEqual([
      ["payment", "Received"],
      ["pickup", "Finding your driver"],
      ["stay", "Finding options"],
      ["services", "Finding · 1 of 2 matched"],
      ["activities", "Waiting for the operator"],
    ]);
    expect(rows[1].lines.join(" ")).toMatch(/Flight BA75.*Lands/);
    // "Recommend me a stay" promises a reply within 48 hours of payment.
    expect(rows[2].lines.join(" ")).toMatch(/recommendations by Sun 2 May/);
    expect(fulfilmentSettled(rows)).toBe(false);
  });

  it("puts a stay ready to approve first, with its button", () => {
    const rows = fulfilmentRows(
      order({
        stays: [stay("OFFERED")],
        services: [service("CAR", "MATCHED")],
      }),
      now,
    );
    expect(rows[0]).toMatchObject({
      key: "stay",
      status: "Hotel ready: approve and pay",
      tone: "act",
      approve: [{ offerId: "s1", priceMinor: 18_000_000 }],
    });
    // A lapsed offer is no longer something to approve.
    const lapsed = fulfilmentRows(
      order({ stays: [stay("OFFERED")] }),
      new Date("2027-05-04T00:00:00Z"),
    );
    expect(lapsed.find((r) => r.key === "stay")?.status).toBe(
      "Finding options",
    );
  });

  it("shows who was matched, and the refund for anything unmatched or declined", () => {
    const rows = fulfilmentRows(
      order({
        services: [
          service("AIRPORT_PICKUP", "MATCHED"),
          service("CAR", "UNMATCHED"),
        ],
        bookings: [booking("CONFIRMED"), booking("DECLINED")],
        stays: [stay("BOOKED")],
      }),
      now,
    );
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.pickup.status).toBe("Driver matched");
    expect(by.pickup.lines.join(" ")).toMatch(
      /Driver: Tunde Bakare · Phone: \+234 801 234 5678 · Vehicle: Toyota Sienna/,
    );
    expect(by.stay.status).toBe("Booked");
    expect(by.services.refund).toMatch(/41,000/);
    expect(by.activities.status).toBe("Confirmed");
    expect(by.activities.refund).toMatch(/20,000/);
    expect(fulfilmentSettled(rows)).toBe(true);
  });

  it("leaves out the stay when the traveller books their own", () => {
    const rows = fulfilmentRows(
      order({ trip: { ...order({}).trip!, accommodationBy: "SELF" } }),
      now,
    );
    expect(rows.map((r) => r.key)).toEqual(["payment"]);
  });
});

describe("status emails", () => {
  it("tells the traveller who their driver is", () => {
    const o = order({ services: [service("AIRPORT_PICKUP", "MATCHED")] });
    const email = serviceUpdateEmail(
      o,
      { service: "AIRPORT_PICKUP", status: "MATCHED", assignee: driver },
      "https://app.test/b",
    )!;
    expect(email.to).toBe("ada@example.test");
    expect(email.subject).toMatch(/Airport pickup matched/);
    expect(email.text).toMatch(/Driver: Tunde Bakare/);
    expect(email.text).toMatch(/Plate: LAG 123 AB/);
    // Still waiting or completed: nothing to email.
    expect(
      serviceUpdateEmail(
        o,
        { service: "AIRPORT_PICKUP", status: "COMPLETED", assignee: driver },
        "https://app.test/b",
      ),
    ).toBeNull();
  });

  it("says a stay is ready to approve, and until when", () => {
    const email = stayOfferedEmail(
      order({}),
      { ...stay("OFFERED"), note: "Sea view <3" },
      "https://app.test/b",
    );
    expect(email.subject).toMatch(/ready to approve: Fictional Lagoon Hotel/);
    expect(email.text).toMatch(/2 nights · Deluxe double/);
    expect(email.text).toMatch(/180,000/);
    expect(email.html).toContain("Sea view &lt;3");
  });
});

describe("arrival day", () => {
  it("starts with the airport pickup, then check-in", () => {
    const o = order({
      services: [service("AIRPORT_PICKUP", "MATCHED", "2027-05-08", "06:10")],
      stays: [stay("BOOKED")],
    });
    const items = arrangedFor("2027-05-08", o);
    expect(items.map((i) => i.kind)).toEqual(["PICKUP", "CHECK_IN"]);
    expect(items[0]).toMatchObject({ time: "06:10", title: "Airport pickup" });
    expect(items[0].lines.join(" ")).toMatch(/Driver: Tunde Bakare/);
    expect(items[1].title).toBe("Check in at Fictional Lagoon Hotel");
    expect(arrangedFor("2027-05-09", o)).toEqual([]);
  });

  it("works without a pickup, and before the driver is matched", () => {
    const noPickup = arrangedFor(
      "2027-05-08",
      order({ stays: [stay("BOOKED")] }),
    );
    expect(noPickup.map((i) => i.kind)).toEqual(["CHECK_IN"]);
    const waiting = arrangedFor(
      "2027-05-08",
      order({
        services: [
          service("AIRPORT_PICKUP", "REQUESTED", "2027-05-08", "00:00"),
        ],
        trip: {
          ...order({}).trip!,
          airportPickup: {
            ...order({}).trip!.airportPickup!,
            landingTime: "",
          },
        },
      }),
    );
    expect(waiting[0].time).toBe("");
    expect(waiting[0].lines).toContain("Finding your driver");
    expect(waiting[0].lines).toContain("Landing time to add");
    // A pickup nobody could be matched to isn't shown as arranged.
    expect(
      arrangedFor(
        "2027-05-08",
        order({ services: [service("AIRPORT_PICKUP", "UNMATCHED")] }),
      ),
    ).toEqual([]);
  });

  it("counts the days until the trip", () => {
    expect(daysUntil("2027-05-08", "2027-05-01")).toBe(7);
  });
});
