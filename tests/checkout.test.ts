import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import rules from "../tourism-v1-handoff/data/pricing.demo.json";
import { initialProfile } from "../src/domain/profile";
import {
  assess,
  assistanceFor,
  defaultServices,
  type Item,
} from "../src/domain/planner";
import { costByDay, unplannedDays } from "../src/domain/checkout";

const profile = {
  ...initialProfile,
  accommodation: "Fictional fixed base",
  zoneId: "LEKKI" as const,
  startDate: "2026-11-10",
  endDate: "2026-11-12",
};
const now = Date.parse("2026-10-24T12:00:00Z");
const item = (
  localDate: string,
  offerId: string,
  startTime: string,
  endTime: string,
): Item => ({
  id: randomUUID(),
  localDate,
  startTime,
  endTime,
  kind: "EXPERIENCE",
  offerId,
  title: offerId,
  locked: false,
});
const walk = item("2026-11-10", "offer-nature-walk", "09:00", "11:00");
const gallery = item("2026-11-10", "offer-gallery", "13:00", "14:30");
const walkAgain = item("2026-11-11", "offer-nature-walk", "09:00", "11:00");
const items = [walk, gallery, walkAgain];
const window = { startTime: "08:00", hours: 8 as const };
const services = {
  ...defaultServices,
  vehicleWindows: { "2026-11-10": window, "2026-11-11": window },
  guideDays: ["2026-11-10"],
  guideItemIds: [walk.id, gallery.id, walkAgain.id],
};

describe("combined guide services", () => {
  it("charges a full-day guide and activity guides together, never twice", () => {
    const price = assess(profile, items, services, fixture.experiences, now);
    expect(price.blockers).toEqual([]);
    // Day 1: full-day guide covers both activities. Day 2: one activity guide.
    expect(price.hostingMinor).toBe(
      rules.guideDayBlock.rateMinor + rules.activityGuideBlock.rateMinor,
    );
    expect(
      price.warnings.filter((w) => w.code === "GUIDE_COVERED"),
    ).toHaveLength(2);
  });
  it("derives the summary choice from what is selected", () => {
    expect(assistanceFor(services)).toBe("FULL_DAY_GUIDE");
    expect(assistanceFor({ guideDays: [], guideItemIds: [walk.id] })).toBe(
      "ACTIVITY_GUIDE",
    );
    expect(assistanceFor({ guideDays: [], guideItemIds: [] })).toBe(
      "DRIVER_ONLY",
    );
  });
});

describe("checkout helpers", () => {
  it("lists trip days with nothing planned", () => {
    expect(unplannedDays(profile, items)).toEqual(["2026-11-12"]);
    expect(unplannedDays(profile, [])).toHaveLength(3);
  });
  it("groups every priced line under its day, in time order", () => {
    const price = assess(profile, items, services, fixture.experiences, now);
    const days = costByDay(profile, price.lines, items);
    expect(days.map((d) => d.day)).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    expect(days.reduce((n, d) => n + d.totalMinor, 0)).toBe(
      price.subtotalMinor,
    );
    expect(days[0].lines.map((l) => l.time).filter(Boolean)).toEqual([
      "09:00–11:00",
      "13:00–14:30",
    ]);
    expect(days[0].lines.some((l) => l.key === "guide:2026-11-10")).toBe(true);
    expect(days[1].lines.some((l) => l.key === `guide:${walkAgain.id}`)).toBe(
      true,
    );
    expect(days[2].lines).toEqual([]);
    expect(
      days.flatMap((d) => d.lines).every((l) => !/^\d{4}-/.test(l.label)),
    ).toBe(true);
  });
});
