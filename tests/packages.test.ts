import { describe, expect, it } from "vitest";
import {
  demoPackages,
  draftPackage,
  packageReadiness,
  packageSchema,
  slugify,
  type PackageRecord,
  type TripPackage,
} from "../src/modules/catalogue/domain/packages";
import { catalogueEditSchema } from "../src/modules/catalogue/domain/catalogue";
import { knownTags, tagIds } from "../src/modules/catalogue/domain/tags";
import type { PackageRepository } from "../src/modules/catalogue/application/ports/package-repository";
import { CreatePackageDraft } from "../src/modules/catalogue/application/use-cases/create-package-draft";
import { ListPublishedPackages } from "../src/modules/catalogue/application/use-cases/list-published-packages";
import { UpdatePackage } from "../src/modules/catalogue/application/use-cases/update-package";

// An in-memory PackageRepository with the same version check as Drizzle.
function memory(rows: PackageRecord[] = []): PackageRepository & {
  rows: PackageRecord[];
} {
  return {
    rows,
    async listPublished() {
      return rows.filter((r) => r.status === "DEMO_PUBLISHED");
    },
    async listAll() {
      return rows;
    },
    async slugTaken(slug) {
      return rows.some((r) => r.slug === slug);
    },
    async create(row) {
      const created = { ...row, version: 1 };
      rows.push(created);
      return created;
    },
    async update(input, decide) {
      const i = rows.findIndex((r) => r.id === input.id);
      const change = decide(rows[i]);
      if (rows[i].version !== input.expectedVersion) return null;
      rows[i] = {
        ...rows[i],
        status: change.status,
        record: change.record,
        version: input.expectedVersion + 1,
      };
      return rows[i];
    },
  };
}

const obudu = (slug: string): TripPackage => ({
  ...draftPackage(slug, "3 days in Obudu Mountains"),
  summary: "Three cool days on the Obudu plateau with a guide and driver.",
  operator: "Highland Tours (sample operator)",
  route: [
    { day: 1, place: "Calabar → Obudu", plan: "Drive up to the plateau." },
    { day: 2, place: "Obudu", plan: "Canopy walk and waterfall hike." },
    { day: 3, place: "Obudu → Calabar", plan: "Cable car, then return." },
  ],
  departures: [{ date: "2026-12-12", seats: "OPEN" }],
  priceMinor: 25000000,
  bookingTerms: ["Pay in full to book (sample terms)."],
  tags: ["mountains", "nature"],
});

describe("ready-made trips", () => {
  it("keeps the demo fixtures valid", () => {
    expect(demoPackages.map((p) => p.slug)).toContain("southwest-heritage");
  });

  it("makes stable web addresses from titles", () => {
    expect(slugify("3 days in Obudu Mountains!")).toBe(
      "3-days-in-obudu-mountains",
    );
    expect(slugify("Ọ̀sun-Òṣogbo grove")).toBe("osun-osogbo-grove");
    expect(slugify("!!!")).toBe("trip");
  });

  it("lists what a trip needs before it can be published", () => {
    const draft = draftPackage("obudu", "3 days in Obudu Mountains");
    expect(packageSchema.safeParse(draft).success).toBe(true);
    expect(packageReadiness(draft, "2026-11-22")).toEqual([
      "Write a summary",
      "Name the operator",
      "Give every day a place and a plan",
      "Set a price above ₦0",
      "Add an upcoming departure with seats",
      "Add the booking terms",
    ]);
    expect(packageReadiness(obudu("obudu"), "2026-11-22")).toEqual([]);
    // A full or past departure doesn't count.
    expect(
      packageReadiness(
        {
          ...obudu("obudu"),
          departures: [
            { date: "2026-11-01", seats: "OPEN" },
            { date: "2026-12-12", seats: "FULL" },
          ],
        },
        "2026-11-22",
      ),
    ).toEqual(["Add an upcoming departure with seats"]);
  });

  it("refuses inconsistent trips", () => {
    const ok = obudu("obudu");
    const bad = (patch: Partial<TripPackage>) =>
      packageSchema.safeParse({ ...ok, ...patch }).success;
    expect(bad({ nights: 5 })).toBe(false);
    expect(bad({ route: [{ ...ok.route[0], day: 2 }] })).toBe(false);
    expect(
      bad({
        departures: [
          { date: "2026-12-12", seats: "OPEN" },
          { date: "2026-12-12", seats: "LIMITED" },
        ],
      }),
    ).toBe(false);
    expect(bad({ tags: ["mountain-ish" as never] })).toBe(false);
  });

  it("creates drafts with unique addresses and publishes only when ready", async () => {
    const repo = memory();
    const create = new CreatePackageDraft(repo);
    const a = await create.execute({
      actorId: "staff",
      title: "3 days in Obudu Mountains",
    });
    const b = await create.execute({
      actorId: "staff",
      title: "3 days in Obudu mountains",
    });
    expect([a.slug, b.slug]).toEqual([
      "3-days-in-obudu-mountains",
      "3-days-in-obudu-mountains-2",
    ]);
    expect(a.status).toBe("DRAFT");

    const update = new UpdatePackage(repo);
    await expect(
      update.execute({
        actorId: "staff",
        edit: {
          id: a.id,
          expectedVersion: 1,
          status: "DEMO_PUBLISHED",
          trip: a.record,
        },
      }),
    ).rejects.toMatchObject({ code: "NOT_READY" });

    const saved = await update.execute({
      actorId: "staff",
      edit: {
        id: a.id,
        expectedVersion: 1,
        status: "DEMO_PUBLISHED",
        // The address can't be changed once created.
        trip: {
          ...obudu("renamed"),
          departures: [{ date: "2099-01-01", seats: "OPEN" }],
        },
      },
    });
    expect(saved.slug).toBe(a.slug);
    expect(saved.record.slug).toBe(a.slug);
    await expect(
      update.execute({
        actorId: "staff",
        edit: {
          id: a.id,
          expectedVersion: 1,
          status: "PAUSED",
          trip: saved.record,
        },
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("shows travellers only published trips and their upcoming departures", async () => {
    const trip = {
      ...obudu("obudu"),
      departures: [
        { date: "2026-12-12", seats: "OPEN" as const },
        { date: "2026-11-01", seats: "OPEN" as const },
      ],
    };
    const repo = memory([
      {
        id: "1",
        slug: "obudu",
        status: "DEMO_PUBLISHED",
        version: 1,
        record: trip,
      },
      {
        id: "2",
        slug: "draft",
        status: "DRAFT",
        version: 1,
        record: obudu("draft"),
      },
    ]);
    const shown = await new ListPublishedPackages(repo).execute("2026-11-22");
    expect(shown.map((p) => p.slug)).toEqual(["obudu"]);
    expect(shown[0].departures).toEqual([
      { date: "2026-12-12", seats: "OPEN" },
    ]);
  });
});

describe("tag vocabulary", () => {
  it("is the only set of tags a listing can be saved with", () => {
    expect(tagIds).toEqual(
      expect.arrayContaining([
        "hosted",
        "event",
        "music",
        "business",
        "festival",
      ]),
    );
    const base = {
      id: "7f0c2a6e-1d1b-4b9a-9a39-3a4d2c6b8e10",
      expectedVersion: 1,
      name: "Rooftop jazz brunch",
      categoryId: "nightlife",
      zoneId: "VI",
      kind: "MAIN",
      durationMinMinutes: 120,
      durationMaxMinutes: 180,
      rateMinor: 100,
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
    expect(
      catalogueEditSchema.safeParse({ ...base, tags: ["music"] }).success,
    ).toBe(true);
    expect(
      catalogueEditSchema.safeParse({ ...base, tags: ["Music"] }).success,
    ).toBe(false);
    expect(knownTags(["music", "Music", "music", "jazz"])).toEqual(["music"]);
  });
});
