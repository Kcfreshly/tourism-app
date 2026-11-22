import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import nightlife from "../src/data/nightlife.demo.json";
import { initialProfile } from "../src/modules/trips/domain/profile";
import {
  assess,
  carCovers,
  defaultServices,
  fitCar,
  pickupReminder,
  type Item,
  type Services,
} from "../src/modules/trips/domain/planner";
import {
  defaultTransportSettings,
  readTransportSettings,
  transportSettingsSchema,
} from "../src/modules/trips/domain/transport-settings";
import {
  clockLabel,
  lagosInstant,
  startTimesOn,
} from "../src/modules/catalogue/domain/schedule";
import { nightReviewIssue } from "../src/modules/catalogue/domain/catalogue";
import type { Experience } from "../src/modules/catalogue/domain/experience";

const offers = [
  ...fixture.experiences,
  ...events.experiences,
  ...nightlife.experiences,
] as Experience[];
const club = offers.find((e) => e.id === "club-night")!;
// A Saturday; the club runs Thursday to Sunday.
const day = "2027-05-08";
const now = Date.parse("2027-05-01T12:00:00+01:00");
const trip = {
  ...initialProfile,
  accommodation: "Fictional fixed base",
  zoneId: "LEKKI" as const,
  startDate: day,
  endDate: "2027-05-09",
  adults: 2,
};
const item = (
  offerId: string,
  startTime: string,
  endTime: string,
  localDate = day,
): Item => ({
  id: randomUUID(),
  localDate,
  startTime,
  endTime,
  kind: "EXPERIENCE",
  offerId,
  title: "Fictional test experience",
  locked: false,
});
const offerFor = (plan: Item[]) => (id: string) =>
  offers.find((o) => o.offer.id === plan.find((i) => i.id === id)!.offerId)!;
const codes = (plan: Item[], services: Services) =>
  assess(trip, plan, services, offers, now).blockers.map((b) => b.code);

describe("car for the day", () => {
  it("fits the shortest block that covers pickup in traffic and the trip back", () => {
    const plan = [
      item("offer-makers", "10:00", "12:00"),
      item("offer-nature-walk", "14:00", "16:00"),
    ];
    // Lekki → VI takes up to 75 minutes; back from Lekki at 16:00 takes 45.
    const fit = fitCar("LEKKI", plan, offerFor(plan), defaultTransportSettings);
    expect(fit).toEqual({ startTime: "08:45", hours: 8 });
    expect(carCovers("LEKKI", plan, offerFor(plan), fit!)).toBe(true);
    expect(
      carCovers("LEKKI", plan, offerFor(plan), {
        startTime: "08:00",
        hours: 8,
      }),
    ).toBe(false);
    const price = assess(
      trip,
      plan,
      { ...defaultServices, vehicleWindows: { [day]: fit! } },
      offers,
      now,
    );
    expect(price.blockers).toEqual([]);
    // ₦45,000 for 8 hours plus ₦10,000 for crossing areas, one car.
    expect(price.transportMinor).toBe(5500000);
  });

  it("offers 10 and 12 hour days, and only the blocks staff configure", () => {
    const long = [item("offer-nature-walk", "09:00", "19:00")];
    const lekki = () => ({ zoneId: "LEKKI" });
    expect(fitCar("LEKKI", long, lekki, defaultTransportSettings)).toEqual({
      startTime: "08:15",
      hours: 12,
    });
    const shortOnly = {
      ...defaultTransportSettings,
      dayBlocks: defaultTransportSettings.dayBlocks.slice(0, 2),
    };
    expect(fitCar("LEKKI", long, lekki, shortOnly)).toBeNull();
    // A length staff removed can't be priced.
    const plan = [item("offer-nature-walk", "09:00", "11:00")];
    const window = { [day]: { startTime: "08:00", hours: 12 } };
    expect(
      assess(
        trip,
        plan,
        { ...defaultServices, vehicleWindows: window },
        offers,
        now,
        shortOnly,
      ).blockers.map((b) => b.code),
    ).toContain("SERVICE_WINDOW");
  });

  it("prices with the rates staff save", () => {
    const plan = [item("offer-nature-walk", "10:00", "12:00")];
    const services = {
      ...defaultServices,
      vehicleWindows: { [day]: { startTime: "09:00", hours: 4 } },
    };
    const dearer = {
      ...defaultTransportSettings,
      dayBlocks: [{ hours: 4, rateMinor: 4000000 }],
    };
    expect(assess(trip, plan, services, offers, now).transportMinor).toBe(
      3000000,
    );
    expect(
      assess(trip, plan, services, offers, now, dearer).transportMinor,
    ).toBe(4000000);
    expect(transportSettingsSchema.safeParse(dearer).success).toBe(true);
    // A stored shape that no longer validates falls back to the defaults.
    expect(readTransportSettings({ seatsPerCar: 0 })).toEqual(
      defaultTransportSettings,
    );
  });
});

describe("own way and night out", () => {
  it("lets one day be own way, and asks how travellers get back late", () => {
    const plan = [item("offer-club-night", "22:00", "26:00")];
    const ownDay = {
      ...defaultServices,
      dayTransport: { [day]: "OWN" as const },
    };
    expect(codes(plan, ownDay)).toEqual(["LATE_RETURN"]);
    const confirmed = { ...ownDay, ownWayBack: [plan[0].id] };
    expect(codes(plan, confirmed)).toEqual([]);
    expect(assess(trip, plan, confirmed, offers, now).transportMinor).toBe(0);
  });

  it("covers a night out with a separate night car that runs past midnight", () => {
    const plan = [item("offer-club-night", "22:00", "26:00")];
    const fit = fitCar(
      "LEKKI",
      plan,
      offerFor(plan),
      defaultTransportSettings,
      "NIGHT",
    );
    // Pickup 75 minutes before 22:00; back in Lekki by 02:45.
    expect(fit).toEqual({ startTime: "20:45", hours: 6 });
    const services = {
      ...defaultServices,
      nightWindows: { [day]: { startTime: fit!.startTime } },
    };
    const price = assess(trip, plan, services, offers, now);
    // No day car is needed for a night-only day.
    expect(price.blockers).toEqual([]);
    expect(price.transportMinor).toBe(5000000);
    expect(price.lines.find((l) => l.key === `night:${day}`)!.label).toContain(
      "02:45 next day",
    );
    // Starting too late misses the pickup.
    expect(
      codes(plan, {
        ...services,
        nightWindows: { [day]: { startTime: "21:30" } },
      }),
    ).toContain("SERVICE_WINDOW");
  });

  it("keeps a night out on the day it started", () => {
    expect(clockLabel("27:00")).toBe("03:00 next day");
    expect(lagosInstant(day, "25:00")).toBe(
      Date.parse("2027-05-09T01:00:00+01:00"),
    );
    // The club offers starts until an hour before it closes at 04:00.
    expect(startTimesOn(club, day).at(-1)).toBe("27:00");
    const night = item("offer-club-night", "23:00", "27:00");
    const early = item("offer-nature-walk", "02:00", "04:00", "2027-05-09");
    const own = {
      ...defaultServices,
      dayTransport: { [day]: "OWN" as const, "2027-05-09": "OWN" as const },
      ownWayBack: [night.id],
    };
    expect(
      assess(trip, [night, early], own, offers, now).blockers.find(
        (b) => b.code === "OVERLAP",
      )?.message,
    ).toContain("from the night before");
  });

  it("publishes a late-night listing only after the night-time review", () => {
    expect(nightReviewIssue(club, "DEMO_PUBLISHED")).toBeNull();
    const unreviewed = { ...club, nightVisitAllowed: false };
    expect(nightReviewIssue(unreviewed, "DEMO_PUBLISHED")?.code).toBe(
      "NIGHT_REVIEW_REQUIRED",
    );
    expect(nightReviewIssue(unreviewed, "DRAFT")).toBeNull();
    const gallery = offers.find((e) => e.id === "gallery")!;
    expect(nightReviewIssue(gallery, "DEMO_PUBLISHED")).toBeNull();
  });
});

describe("pickup address", () => {
  const plan = [item("offer-nature-walk", "10:00", "12:00")];
  const services = {
    ...defaultServices,
    vehicleWindows: { [day]: { startTime: "08:45", hours: 4 } },
  };
  const own = { ...trip, accommodation: "" };
  it("reminds, without blocking, until the traveller adds it", () => {
    const price = assess(own, plan, services, offers, now);
    expect(price.blockers).toEqual([]);
    // 12 hours before the 08:45 pickup on Saturday.
    expect(
      price.warnings.find((w) => w.code === "PICKUP_ADDRESS")?.message,
    ).toBe(
      "Add your pickup address by Fri 7 May, 20:45, 12 hours before your first pickup. You can book now and add it later.",
    );
    const late = pickupReminder(
      own,
      plan,
      services,
      defaultTransportSettings,
      Date.parse(`${day}T06:00:00+01:00`),
    );
    expect(late?.overdue).toBe(true);
    expect(late?.message).toContain("Add your pickup address now");
    // Staff can change the notice.
    expect(
      pickupReminder(own, plan, services, {
        ...defaultTransportSettings,
        pickupAddressNoticeHours: 24,
      })?.message,
    ).toContain("Fri 7 May, 08:45, 24 hours");
  });
  it("isn't asked for when Fastlife books the stay or no car is booked", () => {
    const booked = { ...own, accommodationBy: "FASTLIFE" as const };
    expect(assess(booked, plan, services, offers, now).warnings).toEqual([]);
    const ownWay = { ...services, dayTransport: { [day]: "OWN" as const } };
    expect(
      pickupReminder(own, plan, ownWay, defaultTransportSettings),
    ).toBeNull();
  });
  it("still needs the area, to time and price pickups", () => {
    const noArea = {
      ...own,
      zoneId: "UNDECIDED" as const,
      accommodationBy: "FASTLIFE" as const,
    };
    expect(
      assess(noArea, plan, services, offers, now).blockers.find(
        (b) => b.code === "MISSING_BASE",
      )?.message,
    ).toBe(
      "Choose the area you’d like to stay in, so we can book your stay and time your pickups.",
    );
  });
  it("keeps saved settings when a new setting is added", () => {
    // Saved before the pickup reminder setting existed.
    const older: Record<string, unknown> = {
      ...defaultTransportSettings,
      guideNoticeHours: 48,
    };
    delete older.pickupAddressNoticeHours;
    expect(readTransportSettings(older).guideNoticeHours).toBe(48);
    expect(readTransportSettings(older).pickupAddressNoticeHours).toBe(12);
  });
});
