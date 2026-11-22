import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database/client";
import { sqlStatements } from "../src/database/sql-statements";
import { DrizzleCatalogueRepository } from "../src/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository";
import { DrizzlePackageRepository } from "../src/modules/catalogue/infrastructure/persistence/drizzle-package-repository";
import {
  PublishPartnerExperience,
  PublishPartnerPackage,
} from "../src/modules/catalogue/application/use-cases/publish-partner-listing";
import type {
  CatalogueRecord,
  Experience,
} from "../src/modules/catalogue/domain/experience";
import type {
  PackageRecord,
  TripPackage,
} from "../src/modules/catalogue/domain/packages";
import { DrizzlePartnerRepository } from "../src/modules/partners/infrastructure/persistence/drizzle-partner-repository";
import { DrizzleListingStatsRepository } from "../src/modules/partners/infrastructure/persistence/drizzle-listing-stats-repository";
import type {
  ListingCatalogue,
  LiveListing,
} from "../src/modules/partners/application/ports/listing-catalogue";
import { PartnerAccess } from "../src/modules/partners/application/services/partner-access";
import { ApplyAsPartner } from "../src/modules/partners/application/use-cases/apply-as-partner";
import { DecidePartner } from "../src/modules/partners/application/use-cases/decide-partner";
import {
  DecideSubmission,
  ListSubmissionQueue,
} from "../src/modules/partners/application/use-cases/decide-submission";
import { ListPartnerListings } from "../src/modules/partners/application/use-cases/list-partner-listings";
import {
  GetPartnerDashboard,
  RecordListingVisit,
} from "../src/modules/partners/application/use-cases/partner-dashboard";
import {
  SaveSubmission,
  WithdrawSubmission,
} from "../src/modules/partners/application/use-cases/save-submission";
import { StartSubmission } from "../src/modules/partners/application/use-cases/start-submission";
import type { Partner } from "../src/modules/partners/domain/partner";
import { lagosToday } from "../src/modules/catalogue/domain/events";
import { addDays } from "../src/modules/catalogue/domain/schedule";
import type { CatalogueEdit } from "../src/modules/catalogue/domain/catalogue";

const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const catalogue = new DrizzleCatalogueRepository(() => db);
const packages = new DrizzlePackageRepository(() => db);
const partners = new DrizzlePartnerRepository(() => db);
const stats = new DrizzleListingStatsRepository(() => db);
const access = new PartnerAccess(partners);

// The same adapter the composition root builds.
const live = (r: CatalogueRecord): LiveListing => ({
  productType: "EXPERIENCE",
  productId: r.id,
  name: (r.record as Experience).name,
  status: r.status,
  version: r.version,
  slug: r.seedKey,
  offerId: (r.record as Experience).offer.id,
  partnerId: r.partnerId ?? null,
  record: r.record,
});
const liveTrip = (r: PackageRecord): LiveListing => ({
  productType: "PACKAGE",
  productId: r.id,
  name: r.record.title,
  status: r.status,
  version: r.version,
  slug: r.slug,
  partnerId: r.partnerId ?? null,
  record: r.record,
});
const listings: ListingCatalogue = {
  async owned(partnerId) {
    return [
      ...(await catalogue.listAll())
        .filter((r) => r.partnerId === partnerId)
        .map(live),
      ...(await packages.listAll())
        .filter((r) => r.partnerId === partnerId)
        .map(liveTrip),
    ];
  },
  async find(type, id) {
    if (type === "EXPERIENCE") {
      const r = (await catalogue.listAll()).find((x) => x.id === id);
      return r ? live(r) : null;
    }
    const r = (await packages.listAll()).find((x) => x.id === id);
    return r ? liveTrip(r) : null;
  },
  approveExperience: (c) => new PublishPartnerExperience(catalogue).execute(c),
  approvePackage: (c) => new PublishPartnerPackage(packages).execute(c),
};

const start = new StartSubmission(partners, listings);
const save = new SaveSubmission(partners);
const decide = new DecideSubmission(partners, listings);
const owner = "partner-user-1";
const staff = "staff-1";
let partner: Partner;

// A complete, publishable activity edit from a partner's draft.
function readyEdit(id: string, version: number, record: Experience) {
  return {
    id,
    expectedVersion: version,
    name: "Lagoon kayak morning",
    categoryId: "nature",
    zoneId: "LEKKI",
    kind: "MAIN",
    durationMinMinutes: 120,
    durationMaxMinutes: 150,
    rateMinor: 2500000,
    capacityPerSlot: 8,
    status: "DEMO_PUBLISHED",
    review: {
      content: true,
      rates: true,
      capacity: true,
      policy: true,
      media: true,
    },
    story: {
      teaser: "Paddle the calm lagoon at sunrise",
      summary:
        "A guided kayak along the Lekki lagoon with a stop at the mangroves.",
      why: "",
    },
    details: {
      ...record.details!,
      venue: "Jetty 3, Lekki Phase 1",
    },
    inclusions: ["Kayak and life jacket"],
    exclusions: [],
  } as CatalogueEdit;
}

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  for (const id of [owner, "partner-user-2", "traveller-1"])
    await pg.query(
      "INSERT INTO auth_user (id, name, email) VALUES ($1, $1, $1 || '@example.com')",
      [id],
    );
});

describe("partner onboarding", () => {
  it("applies, can't submit until verified, then is verified by staff", async () => {
    const apply = new ApplyAsPartner(partners);
    partner = await apply.execute({
      userId: owner,
      application: {
        businessName: "Lagoon Paddlers",
        contactEmail: "hello@paddlers.example",
        phone: "+234 801 234 5678",
        offering: "Guided kayak trips on the Lekki lagoon",
      },
    });
    expect(partner.status).toBe("PENDING");
    await expect(access.verified(owner)).rejects.toMatchObject({
      code: "PARTNER_NOT_VERIFIED",
    });
    await expect(access.verified("traveller-1")).rejects.toMatchObject({
      code: "NOT_A_PARTNER",
    });
    const decidePartner = new DecidePartner(partners);
    await expect(
      decidePartner.execute({
        actorId: staff,
        id: partner.id,
        expectedVersion: partner.version,
        status: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    partner = await decidePartner.execute({
      actorId: staff,
      id: partner.id,
      expectedVersion: partner.version,
      status: "VERIFIED",
    });
    expect((await access.verified(owner)).id).toBe(partner.id);
  });
});

describe("partner listings need staff approval", () => {
  let listingId: string;

  it("keeps a new activity out of the catalogue until it's approved", async () => {
    const draft = await start.execute({
      actorId: owner,
      partner,
      productType: "EXPERIENCE",
      name: "Lagoon kayak morning",
    });
    const record = draft.proposed as Experience;
    expect(record.details?.operator).toBe("Lagoon Paddlers");
    // Not ready: sample venue, no price.
    await expect(
      save.execute({
        actorId: owner,
        partner,
        id: draft.id,
        expectedVersion: draft.version,
        submit: true,
        experience: { ...readyEdit(draft.id, 1, record), rateMinor: 0 },
      }),
    ).rejects.toMatchObject({ code: "NOT_READY" });
    const pending = await save.execute({
      actorId: owner,
      partner,
      id: draft.id,
      expectedVersion: draft.version,
      submit: true,
      experience: readyEdit(draft.id, 1, record),
    });
    expect(pending.status).toBe("PENDING");
    // Partners can't publish or mark the review as passed themselves.
    expect((pending.proposed as Experience).status).toBe("DRAFT");
    expect(await catalogue.listAll()).toEqual([]);

    const queue = await new ListSubmissionQueue(partners, listings).execute();
    expect(queue.map((q) => [q.name, q.businessName])).toEqual([
      ["Lagoon kayak morning — DEMO", "Lagoon Paddlers"],
    ]);
    await expect(
      decide.execute({
        actorId: staff,
        id: pending.id,
        expectedVersion: pending.version,
        decision: "DECLINE",
        reason: "Add the jetty number",
      }),
    ).resolves.toMatchObject({
      status: "DECLINED",
      reason: "Add the jetty number",
    });
  });

  it("goes live when staff approve the resubmission", async () => {
    const [item] = await new ListPartnerListings(partners, listings).execute(
      partner,
    );
    const s = item.submission!;
    const resubmitted = await save.execute({
      actorId: owner,
      partner,
      id: s.id,
      expectedVersion: s.version,
      submit: true,
      experience: readyEdit(s.id, 1, s.proposed as Experience),
    });
    // Approving an old version is refused.
    await expect(
      decide.execute({
        actorId: staff,
        id: s.id,
        expectedVersion: s.version,
        decision: "APPROVE",
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const approved = await decide.execute({
      actorId: staff,
      id: s.id,
      expectedVersion: resubmitted.version,
      decision: "APPROVE",
    });
    expect(approved).toMatchObject({ status: "APPROVED", productId: s.id });
    const [row] = await catalogue.listPublished();
    expect(row).toMatchObject({
      id: s.id,
      partnerId: partner.id,
      status: "DEMO_PUBLISHED",
    });
    listingId = row.id;
  });

  it("keeps the live version selling while a change waits for approval", async () => {
    const change = await start.execute({
      actorId: owner,
      partner,
      productType: "EXPERIENCE",
      productId: listingId,
    });
    expect(change.baseVersion).toBe(1);
    // Asking again resumes the same open change.
    expect(
      (
        await start.execute({
          actorId: owner,
          partner,
          productType: "EXPERIENCE",
          productId: listingId,
        })
      ).id,
    ).toBe(change.id);
    const edit = {
      ...readyEdit(change.id, 1, change.proposed as Experience),
      rateMinor: 3000000,
    };
    const pending = await save.execute({
      actorId: owner,
      partner,
      id: change.id,
      expectedVersion: change.version,
      submit: true,
      experience: edit,
    });
    const before = (await catalogue.listPublished())[0];
    expect((before.record as Experience).offer.rateMinor).toBe(2500000);
    await decide.execute({
      actorId: staff,
      id: pending.id,
      expectedVersion: pending.version,
      decision: "APPROVE",
    });
    const after = (await catalogue.listPublished())[0];
    expect((after.record as Experience).offer.rateMinor).toBe(3000000);
    expect(after.version).toBe(2);
  });

  it("refuses another partner's listing", async () => {
    const other = await new ApplyAsPartner(partners).execute({
      userId: "partner-user-2",
      application: {
        businessName: "Other Tours",
        contactEmail: "x@other.example",
        phone: "08012345678",
        offering: "City tours around Lagos Island",
      },
    });
    await expect(
      start.execute({
        actorId: "partner-user-2",
        partner: { ...other, status: "VERIFIED" },
        productType: "EXPERIENCE",
        productId: listingId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("publishes a ready-made trip with its own slug", async () => {
    const draft = await start.execute({
      actorId: owner,
      partner,
      productType: "PACKAGE",
      name: "3 days in Obudu",
    });
    const trip = draft.proposed as TripPackage;
    const departure = addDays(lagosToday(), 30);
    const ready: TripPackage = {
      ...trip,
      summary: "Cable car, ranch walks and the canopy walkway on the plateau.",
      route: [1, 2, 3].map((day) => ({
        day,
        place: "Obudu Mountain Resort",
        plan: "Guided walks",
      })),
      priceMinor: 45000000,
      departures: [{ date: departure, seats: "OPEN" }],
      bookingTerms: ["50% deposit to hold a seat"],
    };
    const pending = await save.execute({
      actorId: owner,
      partner,
      id: draft.id,
      expectedVersion: draft.version,
      submit: true,
      trip: ready,
    });
    await decide.execute({
      actorId: staff,
      id: pending.id,
      expectedVersion: pending.version,
      decision: "APPROVE",
    });
    const [row] = await packages.listPublished();
    expect(row).toMatchObject({
      slug: "3-days-in-obudu",
      partnerId: partner.id,
    });
    expect(row.record.operator).toBe("Lagoon Paddlers");
  });

  it("lets the partner withdraw a draft", async () => {
    const draft = await start.execute({
      actorId: owner,
      partner,
      productType: "EXPERIENCE",
      name: "Sunset paddle",
    });
    await new WithdrawSubmission(partners).execute({
      actorId: owner,
      partner,
      id: draft.id,
      expectedVersion: draft.version,
    });
    const items = await new ListPartnerListings(partners, listings).execute(
      partner,
    );
    expect(items.map((i) => i.name)).not.toContain("Sunset paddle — DEMO");
  });
});

describe("partner dashboard", () => {
  it("counts views, visitors, saves and trip plans for its own listings", async () => {
    const record = new RecordListingVisit(stats);
    const [listing] = await catalogue.listPublished();
    const offerId = (listing.record as Experience).offer.id;
    for (const visitor of ["browser-a", "browser-a", "browser-b"])
      await record.execute({
        productType: "EXPERIENCE",
        productId: listing.id,
        visitorKey: visitor,
      });
    await record.execute({
      productType: "PACKAGE",
      productId: "3-days-in-obudu",
      visitorKey: "browser-c",
    });
    await pg.query(
      "INSERT INTO account_buckets (user_id, offer_ids) VALUES ('traveller-1', $1)",
      [JSON.stringify([offerId, "someone-else"])],
    );
    await pg.query(
      "INSERT INTO trips (id, owner_id, profile, items) VALUES (gen_random_uuid(), gen_random_uuid(), '{}', $1)",
      [JSON.stringify([{ offerId }, { offerId }])],
    );
    const dashboard = await new GetPartnerDashboard(
      partners,
      listings,
      stats,
    ).execute(partner);
    expect(dashboard.totals).toMatchObject({
      views: 4,
      visitors: 3,
      saves: 1,
      tripPlans: 1,
      live: 2,
    });
    expect(dashboard.sales).toBeNull();
    expect(dashboard.daily).toHaveLength(30);
    expect(dashboard.daily.at(-1)).toEqual({ day: lagosToday(), views: 4 });
    expect(dashboard.listings[0]).toMatchObject({
      productId: listing.id,
      views: 3,
      visitors: 2,
      saves: 1,
      tripPlans: 1,
    });
    // Another partner sees none of it.
    const other = await partners.forUser("partner-user-2");
    const theirs = await new GetPartnerDashboard(
      partners,
      listings,
      stats,
    ).execute(other!);
    expect(theirs.totals.views).toBe(0);
    expect(theirs.listings).toEqual([]);
  });
});
