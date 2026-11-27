import { describe, expect, it } from "vitest";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import {
  catalogueEditSchema,
  type CatalogueEdit,
} from "../src/modules/catalogue/domain/catalogue";
import {
  changedFields,
  editedRecord,
  type Experience,
} from "../src/modules/catalogue/domain/experience";
import { storyFor } from "../src/modules/catalogue/domain/experience-content";
import { listingDetails } from "../src/modules/catalogue/domain/listing-details";

const market = fixture.experiences.find(
  (e) => e.id === "local-market",
)! as Experience;

// The payload older clients (and scripts/check-admin.mjs) still send.
const core: CatalogueEdit = {
  id: "7f0c2a6e-1d1b-4b9a-9a39-3a4d2c6b8e10",
  expectedVersion: 1,
  name: market.name,
  categoryId: "local-life",
  zoneId: "MAINLAND",
  kind: "MAIN",
  durationMinMinutes: market.durationMinMinutes,
  durationMaxMinutes: market.durationMaxMinutes,
  rateMinor: 2000000,
  capacityPerSlot: 4,
  status: "DRAFT",
  review: {
    content: false,
    rates: false,
    capacity: false,
    policy: false,
    media: false,
  },
};

const details = {
  operator: "Island Market Walks",
  venue: "Balogun gate 3",
  arrival: "SELF" as const,
  pickupRateMinor: 0,
  childRateMinor: 500000,
  confirmation: "INSTANT" as const,
  partnerHours: 0,
  freeCancellationHours: 24,
};

describe("listings admin edits", () => {
  it("accepts the core payload and keeps every other stored field", () => {
    expect(catalogueEditSchema.safeParse(core).success).toBe(true);
    const next = editedRecord(market, core);
    expect(next.offer.minParty).toBe(market.offer.minParty);
    expect(next.inclusions).toEqual(market.inclusions);
    expect(next.story).toBeUndefined();
    expect(changedFields(market, next)).toEqual([
      "offer.capacityPerSlot",
      "offer.rateMinor",
      "status",
    ]);
  });

  it("stores copy, terms, schedule and access that travellers then see", () => {
    const edit = catalogueEditSchema.parse({
      ...core,
      story: {
        teaser: "Fabric, spice and noise.",
        summary: "A hosted walk through Balogun's fabric lanes.",
        why: "",
      },
      details,
      minAge: 0,
      maxParty: 6,
      availability: { days: [6, 7], opensAt: "10:00", closesAt: "16:00" },
      mobility: { intensity: "HIGH", wheelchairAccess: "NONE" },
      inclusions: ["Host", "Water"],
      unavailableDates: ["2026-12-25"],
    });
    const next = { ...editedRecord(market, edit), seedKey: "local-market" };
    expect(storyFor(next).teaser).toBe("Fabric, spice and noise.");
    const shown = listingDetails(next);
    // Stored details replace the sample, including its minimum age of 12.
    expect(shown.operator).toBe("Island Market Walks");
    expect(shown.confirmation).toBe("INSTANT");
    expect(shown.minAge).toBe(0);
    expect(shown.familySuitable).toBe(true);
    expect(next.offer.maxParty).toBe(6);
    expect(next.availabilityLocal.days).toEqual([6, 7]);
    expect(next.unavailableDates).toEqual(["2026-12-25"]);
  });

  it("falls back to samples until a listing has its own details", () => {
    const shown = listingDetails({ ...market, seedKey: "local-market" });
    expect(shown.confirmation).toBe("PARTNER");
    expect(shown.minAge).toBe(12);
  });

  it("clears media and events with empty values", () => {
    const withMedia = {
      ...market,
      photoId: "lekki-canopy",
      videoUrl: "/v.mp4",
      event: { type: "CONCERT" as const },
    };
    const next = editedRecord(withMedia, {
      ...core,
      photoId: "",
      videoUrl: "",
      event: null,
    });
    expect(next).not.toHaveProperty("photoId");
    expect(next).not.toHaveProperty("videoUrl");
    expect(next).not.toHaveProperty("event");
  });

  it("refuses inconsistent party, hours, sessions and events", () => {
    const issues = (patch: Partial<CatalogueEdit>) =>
      catalogueEditSchema.safeParse({ ...core, ...patch }).success;
    expect(issues({ minParty: 5, maxParty: 2 })).toBe(false);
    expect(
      issues({
        availability: { days: [1], opensAt: "18:00", closesAt: "09:00" },
      }),
    ).toBe(false);
    expect(issues({ schedulingType: "FIXED", sessions: [] })).toBe(false);
    expect(
      issues({
        event: { type: "CONCERT" },
        sessions: [{ startTime: "19:00", durationMinutes: 180 }],
      }),
    ).toBe(false);
    expect(issues({ videoUrl: "javascript:alert(1)" })).toBe(false);
    expect(
      issues({
        schedulingType: "FIXED",
        event: { type: "CONCERT" },
        sessions: [
          { startTime: "19:00", durationMinutes: 180, dates: ["2026-12-05"] },
        ],
      }),
    ).toBe(true);
  });
});
