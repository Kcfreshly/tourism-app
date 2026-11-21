import { describe, it, expect } from "vitest";
import Ajv from "ajv/dist/2020.js";
import {
  initialProfile,
  profileSchema,
} from "../src/modules/trips/domain/profile";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import {
  editedRecord,
  publishBlockers,
} from "../src/modules/catalogue/domain/experience";
import { catalogueEditSchema } from "../src/modules/catalogue/domain/catalogue";
import { assertDemo } from "../src/config/environment";
describe("foundation trust boundaries", () => {
  it("fully validates supplied catalogue fixture schema", () =>
    expect(new Ajv().compile(contract)(fixture)).toBe(true));
  it("rejects impossible dates, long stays, child parties and untrusted fields", () => {
    for (const patch of [
      { startDate: "2026-02-30" },
      { endDate: "2027-01-01" },
      { adults: 0 },
      { adults: 9 },
      { role: "ADMIN" },
      { endDate: "2026-11-09" },
    ])
      expect(
        profileSchema.safeParse({ ...initialProfile, ...patch }).success,
      ).toBe(false);
    expect(profileSchema.safeParse(initialProfile).success).toBe(true);
  });
  it("refuses to promote fictional fixtures", () => {
    for (const record of fixture.experiences)
      expect(publishBlockers(record)).toContain(
        "Fictional demo supply cannot be published live.",
      );
  });
  it("refuses a live checkout flag", () => {
    const old = process.env.LIVE_CHECKOUT_ENABLED;
    process.env.LIVE_CHECKOUT_ENABLED = "true";
    expect(assertDemo).toThrow("Live operation refused");
    if (old === undefined) delete process.env.LIVE_CHECKOUT_ENABLED;
    else process.env.LIVE_CHECKOUT_ENABLED = old;
  });
});

describe("minimum booking notice", () => {
  const old = fixture.experiences.find((e) => e.offer.id === "offer-cooking")!;
  const edit = {
    id: "00000000-0000-4000-8000-000000000001",
    expectedVersion: 1,
    name: old.name,
    categoryId: old.categoryId as "food",
    zoneId: old.zoneId as "LEKKI",
    kind: old.kind as "MAIN",
    durationMinMinutes: old.durationMinMinutes,
    durationMaxMinutes: old.durationMaxMinutes,
    rateMinor: old.offer.rateMinor,
    capacityPerSlot: old.offer.capacityPerSlot,
    status: "DEMO_PUBLISHED" as const,
    review: {
      content: true,
      rates: true,
      capacity: true,
      policy: true,
      media: true,
    },
  };
  it("lets staff set it, and keeps it when an edit leaves it out", () => {
    expect(
      catalogueEditSchema.parse({ ...edit, bookingCutoffHours: 0 }),
    ).toBeTruthy();
    expect(() =>
      catalogueEditSchema.parse({ ...edit, bookingCutoffHours: -1 }),
    ).toThrow();
    expect(
      editedRecord(old as never, { ...edit, bookingCutoffHours: 2 }).offer
        .bookingCutoffHours,
    ).toBe(2);
    expect(editedRecord(old as never, edit).offer.bookingCutoffHours).toBe(24);
  });
});
