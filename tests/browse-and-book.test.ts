import { describe, expect, it } from "vitest";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import {
  toPublishedExperience,
  type PublishedExperience,
} from "../src/modules/catalogue/domain/experience";
import {
  inPriceBand,
  maxRangeDays,
  nextRunDates,
  rangeDays,
  flexibleMinStayMinutes,
  runsOn,
  shortestVisit,
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
  demoPackages,
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

  it("offers hourly starts that leave time for a drop-in visit", () => {
    const beach = listing("beach");
    const times = startTimesOn(beach, "2026-11-21");
    expect(times[0]).toBe(beach.availabilityLocal.opensAt);
    const [h] = times.at(-1)!.split(":").map(Number);
    const [closeH] = beach.availabilityLocal.closesAt.split(":").map(Number);
    // Flexible listings take late arrivals who stay a shorter time.
    expect(shortestVisit(beach)).toBe(flexibleMinStayMinutes);
    expect(h * 60 + flexibleMinStayMinutes).toBe(closeH * 60);
  });

  it("offers today only the starts still ahead, including a late drop-in", () => {
    const walk = listing("nature-walk");
    const day = "2026-11-21";
    const at = (t: string) => Date.parse(`${day}T${t}:00+01:00`);
    expect(startTimesOn(walk, day, at("15:10"))).toEqual([
      "15:15",
      "16:00",
      "17:00",
    ]);
    expect(startTimesOn(walk, day, at("17:10"))).toEqual([]);
    expect(runsOn(walk, day, at("17:10"))).toBe(false);
    expect(runsOn(walk, day)).toBe(true);
  });

  it("runs dated events only on their dates", () => {
    const concert = listing("event-afrobeats-concert");
    expect(runsOn(concert, "2026-11-14")).toBe(true);
    expect(runsOn(concert, "2026-11-15")).toBe(false);
    expect(nextRunDates(concert, "2026-11-16")).toEqual([]);
  });
});

describe("browsing a visit and by price", () => {
  it("lists the days of a visit and caps a runaway range", () => {
    expect(rangeDays("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(rangeDays("2026-12-02", "2026-12-01")).toEqual([]);
    expect(rangeDays("2026-01-01", "2036-01-01")).toHaveLength(maxRangeDays);
  });

  it("finds events that fall inside a visit", () => {
    const festival = listing("event-food-music-festival");
    expect(
      rangeDays("2026-12-15", "2027-01-05").some((d) => runsOn(festival, d)),
    ).toBe(true);
    expect(
      rangeDays("2026-11-20", "2026-11-30").some((d) => runsOn(festival, d)),
    ).toBe(false);
  });

  it("sorts listed prices into bands", () => {
    expect(inPriceBand(900000, "under-10k")).toBe(true);
    expect(inPriceBand(1000000, "under-10k")).toBe(false);
    expect(inPriceBand(1000000, "10k-25k")).toBe(true);
    expect(inPriceBand(2500000, "over-25k")).toBe(true);
    expect(inPriceBand(2500000, "")).toBe(true);
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
    // Lines saved before child ages existed still load, with no ages yet.
    expect(cartLineSchema.parse(line)).toMatchObject({ childAges: [] });
    expect(cartLineSchema.safeParse({ ...line, childAges: [18] }).success).toBe(
      false,
    );
    expect(
      cartLineSchema.safeParse({ ...line, accommodation: "Lekki" }).success,
    ).toBe(false);
  });
});

describe("ready-made trips", () => {
  it("prices travellers and single rooms, and seeds a custom plan", () => {
    const p = demoPackages.find((d) => d.slug === "southwest-heritage")!;
    expect(
      sumRows(packageLinePrice({ travellers: 2, singleRooms: 1 }, p)),
    ).toBe(2 * p.priceMinor + p.singleSupplementMinor);
    expect(planSeed(p, "2026-12-04")).toMatchObject({
      startDate: "2026-12-04",
      endDate: "2026-12-07",
    });
  });
});
