import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import events from "../src/data/events.demo.json";
import { initialProfile } from "../src/modules/trips/domain/profile";
import {
  availableStarts,
  assess,
  defaultServices,
} from "../src/modules/trips/domain/planner";
import {
  demoDateShift,
  eventDates,
  eventWhen,
  eventsInWindow,
  sessionDates,
  shiftSessionDates,
  upcomingEvents,
} from "../src/modules/catalogue/domain/events";
import type { Experience } from "../src/modules/catalogue/domain/experience";

const offers = events.experiences as Experience[];
const concert = offers.find((e) => e.id === "event-afrobeats-concert")!;
const studio = offers.find((e) => e.id === "event-studio-set")!;
const profile = {
  ...initialProfile,
  accommodation: "Fictional fixed base",
  zoneId: "VI" as const,
  startDate: "2026-11-10",
  endDate: "2026-11-16",
};
const services = {
  ...defaultServices,
  vehicleWindows: Object.fromEntries(
    ["2026-11-13", "2026-11-14"].map((day) => [
      day,
      { startTime: "15:00", hours: 8 as const },
    ]),
  ),
};
const now = Date.parse("2026-10-24T12:00:00Z");
const concertOn = (localDate: string) => ({
  id: randomUUID(),
  localDate,
  startTime: "19:00",
  endTime: "23:00",
  kind: "EXPERIENCE" as const,
  offerId: concert.offer.id,
  title: concert.name,
  locked: false,
});

describe("dated events", () => {
  it("satisfy the catalogue fixture contract and stay fictional", () => {
    expect(new Ajv().compile(contract)(events)).toBe(true);
    for (const e of events.experiences) {
      expect(e.isDemo).toBe(true);
      expect(e.name).toMatch(/DEMO$/);
      expect(e.schedulingType).toBe("FIXED");
      expect(e.sessions.every((s) => s.dates.length > 0)).toBe(true);
    }
  });
  it("lists only events that run within the trip dates, soonest first", () => {
    expect(
      eventsInWindow(offers, "2026-11-10", "2026-11-16").map((e) => e.id),
    ).toEqual([
      "event-highlife-night",
      "event-conference",
      "event-studio-set",
      "event-afrobeats-concert",
    ]);
    expect(
      eventsInWindow(offers, "2026-12-18", "2026-12-28").map((e) => e.id),
    ).toEqual(["event-food-music-festival", "event-street-carnival"]);
    expect(eventsInWindow(offers, "2027-01-05", "2027-01-09")).toEqual([]);
    expect(upcomingEvents(offers, "2026-12-21").map((e) => e.id)).toEqual([
      "event-street-carnival",
    ]);
  });
  it("describes when an event runs within a window", () => {
    expect(eventWhen(concert)).toBe("Sat 14 Nov · 19:00");
    expect(eventDates(studio, "2026-11-10", "2026-11-16")).toEqual([
      "2026-11-12",
      "2026-11-13",
    ]);
    expect(eventWhen(studio, "2026-11-10", "2026-11-16")).toBe(
      "Thu 12 Nov · 14:00 · +1 more date",
    );
  });
  it("only fits on the dates it runs, at its fixed time", () => {
    expect(
      availableStarts(profile, concert, "2026-11-14", [], services, offers).map(
        (c) => [c.startTime, c.endTime],
      ),
    ).toEqual([["19:00", "23:00"]]);
    expect(
      availableStarts(profile, concert, "2026-11-13", [], services, offers),
    ).toEqual([]);
  });
  it("blocks an event scheduled on a day it does not run", () => {
    const valid = assess(
      profile,
      [concertOn("2026-11-14")],
      services,
      offers,
      now,
    );
    expect(valid.blockers.filter((b) => b.itemId)).toEqual([]);
    const wrongDay = assess(
      profile,
      [concertOn("2026-11-13")],
      services,
      offers,
      now,
    );
    expect(wrongDay.blockers.map((b) => b.code)).toContain("SESSION");
  });
});

describe("refreshing demo event dates", () => {
  it("moves the earliest date to tomorrow or later in whole weeks", () => {
    const dates = ["2026-11-10", "2026-11-14", "2026-12-27"];
    expect(demoDateShift(dates, "2026-11-01")).toBe(0);
    expect(demoDateShift(dates, "2026-11-09")).toBe(0);
    expect(demoDateShift(dates, "2026-11-10")).toBe(7);
    expect(demoDateShift(dates, "2026-11-21")).toBe(14);
    expect(demoDateShift([], "2026-11-21")).toBe(0);
  });
  it("shifts only session dates and keeps each weekday", () => {
    const record = {
      id: "e",
      sessions: [
        { startTime: "19:00", dates: ["2026-11-14", "2026-11-15"] },
        { startTime: "10:00" },
      ],
    };
    const moved = shiftSessionDates(record, 14);
    expect(moved.sessions[0].dates).toEqual(["2026-11-28", "2026-11-29"]);
    expect(moved.sessions![1]).toEqual({ startTime: "10:00" });
    expect(record.sessions[0].dates?.[0]).toBe("2026-11-14");
    expect(new Date("2026-11-28").getUTCDay()).toBe(
      new Date("2026-11-14").getUTCDay(),
    );
    expect(sessionDates([moved])).toEqual(["2026-11-28", "2026-11-29"]);
  });
});
