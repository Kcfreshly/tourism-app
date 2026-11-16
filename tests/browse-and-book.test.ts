import { describe, expect, it } from "vitest";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import {
  toPublishedExperience,
  type PublishedExperience,
} from "../src/modules/catalogue/domain/experience";
import {
  nextRunDates,
  runsOn,
  startTimesOn,
  weekendDates,
} from "../src/modules/catalogue/domain/schedule";
import { listingDetails } from "../src/modules/catalogue/domain/listing-details";
import {
  cartLineSchema,
  cartTotals,
  experienceLinePrice,
  packageLinePrice,
  sumRows,
} from "../src/modules/bookings/domain/cart";
import {
  packageBySlug,
  planSeed,
} from "../src/modules/catalogue/domain/packages";

const listing = (id: string) =>
  toPublishedExperience({
    id,
    seedKey: id,
    record: [...fixture.experiences, ...events.experiences].find(
      (e) => e.id === id,
    ),
  }) as PublishedExperience;

describe("browsing by date", () => {
  it("finds this weekend from a weekday, and only today on a Sunday", () => {
    expect(weekendDates("2026-11-16")).toEqual(["2026-11-21", "2026-11-22"]);
    expect(weekendDates("2026-11-21")).toEqual(["2026-11-21", "2026-11-22"]);
    expect(weekendDates("2026-11-22")).toEqual(["2026-11-22"]);
  });

  it("offers hourly starts that still finish by closing time", () => {
    const beach = listing("beach");
    const times = startTimesOn(beach, "2026-11-21");
    expect(times[0]).toBe(beach.availabilityLocal.opensAt);
    const [h] = times.at(-1)!.split(":").map(Number);
    const [closeH] = beach.availabilityLocal.closesAt.split(":").map(Number);
    expect(h * 60 + beach.durationMinMinutes).toBeLessThanOrEqual(closeH * 60);
  });

  it("runs dated events only on their dates", () => {
    const concert = listing("event-afrobeats-concert");
    expect(runsOn(concert, "2026-11-14")).toBe(true);
    expect(runsOn(concert, "2026-11-15")).toBe(false);
    expect(nextRunDates(concert, "2026-11-16")).toEqual([]);
  });
});

describe("cart", () => {
  it("prices children separately and adds pickup only when chosen", () => {
    const beach = listing("beach");
    const details = listingDetails(beach);
    expect(details.familySuitable).toBe(true);
    const rows = experienceLinePrice(
      { adults: 2, children: 2, pickup: true },
      beach.offer,
      details,
    );
    expect(sumRows(rows)).toBe(
      2 * beach.offer.rateMinor +
        2 * details.childRateMinor +
        details.pickupRateMinor,
    );
    expect(
      sumRows(
        experienceLinePrice(
          { adults: 2, children: 0, pickup: false },
          beach.offer,
          details,
        ),
      ),
    ).toBe(2 * beach.offer.rateMinor);
  });

  it("charges a group price once whatever the party size", () => {
    const market = listing("local-market");
    const rows = experienceLinePrice(
      { adults: 3, children: 1, pickup: false },
      market.offer,
      listingDetails(market),
    );
    expect(sumRows(rows)).toBe(market.offer.rateMinor);
  });

  it("totals independent lines with a fee per line", () => {
    expect(cartTotals([1500000, 2000000])).toEqual({
      subtotalMinor: 3500000,
      feeMinor: 350000,
      totalMinor: 3850000,
    });
  });

  it("keeps an experience line free of any itinerary or accommodation", () => {
    const line = {
      kind: "EXPERIENCE",
      id: "a",
      offerId: "offer-gardens",
      date: "2026-11-21",
      time: "10:00",
      adults: 2,
      children: 1,
      pickup: false,
      pickupAddress: "",
    };
    expect(cartLineSchema.safeParse(line).success).toBe(true);
    expect(
      cartLineSchema.safeParse({ ...line, accommodation: "Lekki" }).success,
    ).toBe(false);
  });
});

describe("ready-made trips", () => {
  it("prices travellers and single rooms, and seeds a custom plan", () => {
    const p = packageBySlug("southwest-heritage")!;
    expect(
      sumRows(packageLinePrice({ travellers: 2, singleRooms: 1 }, p)),
    ).toBe(2 * p.priceMinor + p.singleSupplementMinor);
    expect(planSeed(p, "2026-12-04")).toMatchObject({
      startDate: "2026-12-04",
      endDate: "2026-12-07",
    });
  });
});
