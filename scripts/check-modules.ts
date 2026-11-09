// Runs the module use cases against the local database (migrate and seed first).
// Exercises repositories, version checks and transaction rollbacks without HTTP.
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { db } from "../src/database/client";
import { user } from "../src/database/schema";
import { DrizzleBucketRepository } from "../src/modules/bucket/infrastructure/persistence/drizzle-bucket-repository";
import { SaveBucket } from "../src/modules/bucket/application/use-cases/save-bucket";
import { DrizzleCatalogueRepository } from "../src/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository";
import { ListPublishedExperiences } from "../src/modules/catalogue/application/use-cases/list-published-experiences";
import { UpdateCatalogueRecord } from "../src/modules/catalogue/application/use-cases/update-catalogue-record";
import { CreateCatalogueDraft } from "../src/modules/catalogue/application/use-cases/create-catalogue-draft";
import { DrizzleTripRepository } from "../src/modules/trips/infrastructure/persistence/drizzle-trip-repository";
import { DrizzleProposalRepository } from "../src/modules/trips/infrastructure/persistence/drizzle-proposal-repository";
import { OfferSelection } from "../src/modules/trips/application/services/offer-selection";
import { CreateTrip } from "../src/modules/trips/application/use-cases/create-trip";
import { LoadOwnedTrip } from "../src/modules/trips/application/use-cases/load-owned-trip";
import { GenerateProposal } from "../src/modules/trips/application/use-cases/generate-proposal";
import { ApplyProposal } from "../src/modules/trips/application/use-cases/apply-proposal";
import { SaveWorkspace } from "../src/modules/trips/application/use-cases/save-workspace";
import { initialProfile } from "../src/modules/trips/domain/profile";
import { AppError } from "../src/shared/application/app-error";

const refused = async (p: Promise<unknown>, code: string) =>
  assert.equal(((await p.catch((e) => e)) as AppError).code, code);

const userId = randomUUID();
await db()
  .insert(user)
  .values({ id: userId, name: "Verify", email: `${userId}@example.test` });
const actor = { id: userId, role: "CUSTOMER", kind: "ACCOUNT" as const };

const catalogue = new DrizzleCatalogueRepository(db);
const listPublished = new ListPublishedExperiences(catalogue);
const published = await listPublished.execute();
assert.ok(published.length > 0);
const offers = { listPublished: () => listPublished.execute() };

const buckets = new DrizzleBucketRepository(db);
const save = new SaveBucket(buckets, {
  ids: async () => new Set(published.map((e) => e.offer.id)),
});
const b1 = await save.execute({
  userId,
  offerIds: [published[0].offer.id, "gone"],
  expectedVersion: 0,
});
assert.deepEqual(b1, { offerIds: [published[0].offer.id], version: 1 });
await refused(
  save.execute({ userId, offerIds: [], expectedVersion: 0 }),
  "VERSION_CONFLICT",
);
console.log("bucket: save, cleanup and version conflict ok");

const trips = new DrizzleTripRepository(db);
const proposals = new DrizzleProposalRepository(db);
const selection = new OfferSelection(offers);
const profile = {
  ...initialProfile,
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  accommodation: "Verify base",
  zoneId: "LEKKI" as const,
  selectedOfferIds: [published[0].offer.id, "gone"],
};
const trip = await new CreateTrip(trips, selection).execute(actor, profile);
assert.deepEqual((trip.profile as typeof profile).selectedOfferIds, [
  published[0].offer.id,
]);
const load = new LoadOwnedTrip(trips);
await refused(
  load.execute(trip.id, { id: randomUUID(), kind: "ACCOUNT" }),
  "NOT_FOUND",
);
let context = await load.execute(trip.id, actor);
const preview = await new GenerateProposal(
  proposals,
  offers,
  selection,
).execute(context);
assert.ok(preview.items.length > 0);
const apply = new ApplyProposal(proposals, offers);
const applied = await apply.execute(context, {
  proposalId: preview.id,
  expectedVersion: preview.expectedVersion,
});
assert.equal(applied.trip.version, 2);
await refused(
  apply.execute(context, {
    proposalId: preview.id,
    expectedVersion: preview.expectedVersion,
  }),
  "STALE_PROPOSAL",
);
console.log("trips: create, ownership, proposal preview, apply once ok");

context = await load.execute(trip.id, actor);
const saveWorkspace = new SaveWorkspace(trips, offers);
const saved = await saveWorkspace.execute(context, {
  expectedVersion: 2,
  items: context.items,
  services: context.services,
});
assert.equal(saved.trip.version, 3);
await refused(
  saveWorkspace.execute(context, {
    expectedVersion: 2,
    items: context.items,
    services: context.services,
  }),
  "VERSION_CONFLICT",
);
// A proposal made from an old version cannot be applied after the trip moved on.
const stale = await new GenerateProposal(proposals, offers, selection).execute(
  await load.execute(trip.id, actor),
);
await saveWorkspace.execute(await load.execute(trip.id, actor), {
  expectedVersion: 3,
  items: context.items,
  services: context.services,
});
await refused(
  apply.execute(context, {
    proposalId: stale.id,
    expectedVersion: stale.expectedVersion,
  }),
  "VERSION_CONFLICT",
);
// The claim rolled back with the failed update, so the proposal is still unapplied.
await refused(
  apply.execute(context, {
    proposalId: stale.id,
    expectedVersion: stale.expectedVersion,
  }),
  "VERSION_CONFLICT",
);
console.log("workspace: autosave version checks ok");

const draft = await new CreateCatalogueDraft(catalogue).execute({
  actorId: userId,
  name: "Verify draft",
});
const update = new UpdateCatalogueRecord(catalogue);
const edit = {
  id: draft.id,
  expectedVersion: 1,
  name: "Verify draft",
  categoryId: "nature",
  zoneId: "LEKKI",
  kind: "MAIN",
  durationMinMinutes: 60,
  durationMaxMinutes: 90,
  rateMinor: 5000,
  capacityPerSlot: 4,
  status: "DEMO_PUBLISHED",
  review: {
    content: true,
    rates: true,
    capacity: true,
    policy: true,
    media: true,
  },
} as const;
await refused(update.execute({ actorId: userId, edit }), "VERIFY_FIRST");
const verified = await update.execute({
  actorId: userId,
  edit: { ...edit, status: "DEMO_VERIFIED" },
});
assert.equal(verified.version, 2);
await refused(
  update.execute({
    actorId: userId,
    edit: { ...edit, status: "DEMO_VERIFIED" },
  }),
  "VERSION_CONFLICT",
);
await refused(
  update.execute({ actorId: userId, edit: { ...edit, id: randomUUID() } }),
  "NOT_FOUND",
);
console.log("catalogue: draft, review rules, versioning ok");
process.exit(0);
