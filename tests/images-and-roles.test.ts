import { describe, expect, it } from "vitest";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import {
  makePrimary,
  sniffImageType,
} from "../src/modules/catalogue/domain/images";
import {
  editedRecord,
  toPublishedExperience,
  type Experience,
} from "../src/modules/catalogue/domain/experience";
import { catalogueEditSchema } from "../src/modules/catalogue/domain/catalogue";
import { isAdmin, isSuperAdmin } from "../src/modules/identity/domain/actor";
import { sqlStatements } from "../src/database/sql-statements";

const gallery = fixture.experiences.find(
  (e) => e.id === "gallery",
)! as Experience;
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

describe("listing photos", () => {
  it("recognises photos by their bytes, not their name", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(
      sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")),
    ).toBeNull();
  });

  it("moves the chosen photo to the front as primary", () => {
    expect(makePrimary(["x", "y", "z"], 2)).toEqual(["z", "x", "y"]);
    expect(makePrimary(["x", "y"], 0)).toEqual(["x", "y"]);
  });

  it("shows the primary photo on cards and all photos in the gallery", () => {
    const record = {
      ...gallery,
      images: [
        { id: b, alt: "Main hall" },
        { id: a, alt: "" },
      ],
    };
    const shown = toPublishedExperience({
      id: "row",
      seedKey: "gallery",
      record,
    });
    expect(shown.imagePath).toBe(`/api/v1/media/${b}`);
    expect(shown.photos).toEqual([`/api/v1/media/${b}`, `/api/v1/media/${a}`]);
    expect(shown.photoAlts).toEqual(["Main hall", ""]);
    // Own photos replace the labelled inspiration photo.
    expect(shown.inspirationPhoto).toBeUndefined();
    const plain = toPublishedExperience({
      id: "row",
      seedKey: "gallery",
      record: gallery,
    });
    expect(plain.photos).toBeUndefined();
    expect(plain.inspirationPhoto).toBeDefined();
  });

  it("saves, reorders and clears photos through an edit", () => {
    const base = {
      id: "7f0c2a6e-1d1b-4b9a-9a39-3a4d2c6b8e10",
      expectedVersion: 1,
      name: gallery.name,
      categoryId: "culture",
      zoneId: "LEKKI",
      kind: "MAIN",
      durationMinMinutes: gallery.durationMinMinutes,
      durationMaxMinutes: gallery.durationMaxMinutes,
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
    } as const;
    const withPhotos = catalogueEditSchema.parse({
      ...base,
      images: [
        { id: a, alt: "Entrance" },
        { id: b, alt: "" },
      ],
    });
    expect(editedRecord(gallery, withPhotos).images?.map((i) => i.id)).toEqual([
      a,
      b,
    ]);
    expect(
      editedRecord(
        { ...gallery, images: [{ id: a, alt: "" }] },
        { ...withPhotos, images: [] },
      ),
    ).not.toHaveProperty("images");
    expect(
      catalogueEditSchema.safeParse({
        ...base,
        images: [
          { id: a, alt: "" },
          { id: a, alt: "" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("staff roles", () => {
  it("gives super admins every admin right plus delete", () => {
    const as = (role: string) => ({ id: "x", role, kind: "ACCOUNT" as const });
    expect(isAdmin(as("ADMIN"))).toBe(true);
    expect(isAdmin(as("SUPER_ADMIN"))).toBe(true);
    expect(isAdmin(as("CUSTOMER"))).toBe(false);
    expect(isSuperAdmin(as("ADMIN"))).toBe(false);
    expect(isSuperAdmin(as("SUPER_ADMIN"))).toBe(true);
  });
});

describe("migration statements", () => {
  it("keeps function bodies, quotes and comments whole", () => {
    expect(
      sqlStatements(`
        -- a comment; with a semicolon
        CREATE TABLE t (a text DEFAULT 'x;y');
        CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'no'; END
        $$;
        DO $body$ BEGIN PERFORM 1; END $body$;
      `),
    ).toEqual([
      "-- a comment; with a semicolon\n        CREATE TABLE t (a text DEFAULT 'x;y')",
      "CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$\n        BEGIN RAISE EXCEPTION 'no'; END\n        $$",
      "DO $body$ BEGIN PERFORM 1; END $body$",
    ]);
  });
});
