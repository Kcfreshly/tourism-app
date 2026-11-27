import { describe, expect, it } from "vitest";
import {
  initialProfile,
  profileSchema,
  type Profile,
} from "../src/modules/trips/domain/profile";
import {
  assess,
  defaultServices,
  flightReminder,
} from "../src/modules/trips/domain/planner";
import {
  defaultTransportSettings,
  readTransportSettings,
} from "../src/modules/trips/domain/transport-settings";
import { tripCheckoutLines } from "../src/modules/bookings/domain/trip-checkout";
import { assigneeProblem } from "../src/modules/bookings/domain/service-request";
import { onlyBookedEditsChanged } from "../src/modules/trips/domain/booked-trip";
import { extractProfile } from "../src/modules/trips/domain/intake";
import { lagosInstant } from "../src/modules/catalogue/domain/schedule";
import { ListServiceQueue } from "../src/modules/bookings/application/use-cases/service-requests";
import type { QueuedService } from "../src/modules/bookings/application/ports/service-request-repository";

const pickup = {
  airport: "LOS" as const,
  flight: "BA75",
  landingDate: "2027-05-08",
  landingTime: "06:10",
  travellers: 2,
  bags: 3,
};
const trip: Profile = {
  ...initialProfile,
  zoneId: "LEKKI",
  startDate: "2027-05-08",
  endDate: "2027-05-10",
  adults: 2,
  fromAbroad: true,
  airportPickup: pickup,
};
const now = Date.parse("2027-05-01T12:00:00+01:00");

describe("airport pickup", () => {
  it("is priced flat from transport settings, ₦40,000 by default", () => {
    expect(defaultTransportSettings.airportPickupMinor).toBe(4_000_000);
    // Settings saved before the field existed take the default.
    const older: Record<string, unknown> = { ...defaultTransportSettings };
    delete older.airportPickupMinor;
    expect(readTransportSettings(older).airportPickupMinor).toBe(4_000_000);

    const price = assess(trip, [], defaultServices, [], now, {
      ...defaultTransportSettings,
      airportPickupMinor: 5_000_000,
    });
    const line = price.lines.find((l) => l.key === "airport:2027-05-08");
    expect(line).toMatchObject({ group: "transport", totalMinor: 5_000_000 });
    expect(price.transportMinor).toBe(5_000_000);
    const none = assess(
      { ...trip, airportPickup: undefined },
      [],
      defaultServices,
      [],
      now,
    );
    expect(none.lines.some((l) => l.key.startsWith("airport:"))).toBe(false);
  });

  it("keeps the landing date in the trip and the party on the trip", () => {
    expect(profileSchema.safeParse(trip).success).toBe(true);
    const early = profileSchema.safeParse({
      ...trip,
      airportPickup: { ...pickup, landingDate: "2027-05-07" },
    });
    expect(early.success).toBe(false);
    const crowd = profileSchema.safeParse({
      ...trip,
      airportPickup: { ...pickup, travellers: 3 },
    });
    expect(crowd.success).toBe(false);
    // Flight numbers are tidied; nonsense is refused; blank is fine.
    const tidy = profileSchema.parse({
      ...trip,
      airportPickup: { ...pickup, flight: "ba 75" },
    });
    expect(tidy.airportPickup?.flight).toBe("BA75");
    expect(
      profileSchema.safeParse({
        ...trip,
        airportPickup: { ...pickup, flight: "not a flight" },
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        ...trip,
        airportPickup: { ...pickup, flight: "", landingTime: "" },
      }).success,
    ).toBe(true);
  });

  it("reminds, without blocking, until the flight details are in", () => {
    const missing = { airportPickup: { ...pickup, flight: "" } };
    const settings = { pickupAddressNoticeHours: 12 };
    const due = lagosInstant("2027-05-08", "00:00") - 12 * 3600000;
    expect(flightReminder(missing, settings, due - 1)).toMatchObject({
      overdue: false,
    });
    expect(flightReminder(missing, settings, due)?.message).toMatch(
      /flight number now/,
    );
    expect(flightReminder(trip, settings, now)).toBeNull();
    const price = assess({ ...trip, ...missing }, [], defaultServices, [], now);
    expect(price.warnings.map((w) => w.code)).toContain("FLIGHT_DETAILS");
    expect(price.blockers).toEqual([]);
  });

  it("becomes a service staff match, 48 hours before landing", () => {
    const price = assess(trip, [], defaultServices, [], now);
    const { lines, problems } = tripCheckoutLines(
      { profile: trip, items: [], services: defaultServices, price },
      [],
      now,
    );
    expect(problems).toEqual([]);
    expect(lines).toHaveLength(1);
    const line = lines[0].line;
    expect(line).toMatchObject({
      kind: "SERVICE",
      service: "AIRPORT_PICKUP",
      date: "2027-05-08",
      startTime: "06:10",
      matchBy: new Date(
        lagosInstant("2027-05-08", "06:10") - 48 * 3600000,
      ).toISOString(),
    });
    // Landing too soon to match a driver.
    const late = tripCheckoutLines(
      { profile: trip, items: [], services: defaultServices, price },
      [],
      lagosInstant("2027-05-07", "12:00"),
    );
    expect(late.problems.join(" ")).toMatch(/48 hours’ notice/);
    // A driver needs a car and plate, like any car.
    expect(
      assigneeProblem("AIRPORT_PICKUP", {
        name: "Ade",
        phone: "+2348012345678",
        vehicle: "",
        plate: "",
      }),
    ).toMatch(/plate/);
  });

  it("lets flight details change after booking, but not the pickup", () => {
    const later = (changes: Partial<typeof pickup>) => ({
      ...trip,
      airportPickup: { ...pickup, ...changes },
    });
    expect(
      onlyBookedEditsChanged(trip, later({ flight: "VS411", bags: 5 })),
    ).toBe(true);
    expect(onlyBookedEditsChanged(trip, later({ landingTime: "07:00" }))).toBe(
      true,
    );
    expect(
      onlyBookedEditsChanged(trip, later({ landingDate: "2027-05-09" })),
    ).toBe(false);
    expect(
      onlyBookedEditsChanged(trip, { ...trip, airportPickup: undefined }),
    ).toBe(false);
  });

  it("is understood from a chat message", () => {
    const base = {
      ...initialProfile,
      startDate: "2027-05-08",
      endDate: "2027-05-10",
    };
    const { profile } = extractProfile(
      base,
      "We're flying in from London, please pick us up at the airport. Flight BA 75 landing at 6:10 with 3 bags.",
    );
    expect(profile.fromAbroad).toBe(true);
    expect(profile.airportPickup).toMatchObject({
      flight: "BA75",
      landingTime: "06:10",
      landingDate: "2027-05-08",
      bags: 3,
      travellers: base.adults,
    });
    const no = extractProfile(profile, "No airport pickup, thanks");
    expect(no.profile.airportPickup).toBeUndefined();
  });

  it("shows staff the trip's current flight in the matching queue", async () => {
    const queued = (id: string, service: QueuedService["service"]) =>
      ({
        id,
        version: 1,
        userId: "u",
        tripId: "t1",
        orderReference: "FL-1",
        service,
        date: "2027-05-08",
        startTime: "06:10",
        label: "",
        status: "REQUESTED",
        matchBy: new Date(now).toISOString(),
        assignee: null,
        contact: { name: "A", phone: "+234" },
        totalMinor: 1,
      }) satisfies QueuedService;
    const list = new ListServiceQueue(
      {
        listQueue: async () => [
          queued("a", "AIRPORT_PICKUP"),
          queued("b", "CAR"),
        ],
        find: async () => null,
        update: async () => null,
        expireOverdue: async () => [],
      },
      { execute: async () => {} } as never,
      {
        arrangements: async () =>
          new Map([
            ["t1", { ...trip, airportPickup: { ...pickup, flight: "VS411" } }],
          ]),
      },
    );
    const [a, b] = await list.execute();
    expect(a.arrival?.flight).toBe("VS411");
    expect(b.arrival).toBeUndefined();
  });
});
