// Composition root: the only place that creates infrastructure and hands it to
// use cases and controllers. Route files and server pages import from here.
import { allowedOrigins } from "@/config/environment";
import { db } from "@/database/client";
import { GetBucket } from "@/modules/bucket/application/use-cases/get-bucket";
import { SaveBucket } from "@/modules/bucket/application/use-cases/save-bucket";
import { DrizzleBucketRepository } from "@/modules/bucket/infrastructure/persistence/drizzle-bucket-repository";
import { createGetBucketController } from "@/modules/bucket/presentation/http/controllers/get-bucket-controller";
import { createSaveBucketController } from "@/modules/bucket/presentation/http/controllers/save-bucket-controller";
import { CreateCatalogueDraft } from "@/modules/catalogue/application/use-cases/create-catalogue-draft";
import { GetPublishedExperience } from "@/modules/catalogue/application/use-cases/get-published-experience";
import { ListCatalogueRecords } from "@/modules/catalogue/application/use-cases/list-catalogue-records";
import { ListPublishedExperiences } from "@/modules/catalogue/application/use-cases/list-published-experiences";
import { UpdateCatalogueRecord } from "@/modules/catalogue/application/use-cases/update-catalogue-record";
import { DrizzleCatalogueRepository } from "@/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository";
import { createCreateCatalogueDraftController } from "@/modules/catalogue/presentation/http/controllers/create-catalogue-draft-controller";
import { createListCatalogueRecordsController } from "@/modules/catalogue/presentation/http/controllers/list-catalogue-records-controller";
import { createUpdateCatalogueRecordController } from "@/modules/catalogue/presentation/http/controllers/update-catalogue-record-controller";
import { createGetExperienceController } from "@/modules/catalogue/presentation/http/controllers/get-experience-controller";
import { createListExperiencesController } from "@/modules/catalogue/presentation/http/controllers/list-experiences-controller";
import { EndSession } from "@/modules/identity/application/use-cases/end-session";
import { MergeGuestDrafts } from "@/modules/identity/application/use-cases/merge-guest-drafts";
import { ResolveActor } from "@/modules/identity/application/use-cases/resolve-actor";
import { ThrottleRequest } from "@/modules/identity/application/use-cases/throttle-request";
import { BetterAuthSessionReader } from "@/modules/identity/infrastructure/auth/better-auth-session-reader";
import { DrizzleActorRepository } from "@/modules/identity/infrastructure/persistence/drizzle-actor-repository";
import { DrizzleGuestSessionRepository } from "@/modules/identity/infrastructure/persistence/drizzle-guest-session-repository";
import { DrizzleRateLimiter } from "@/modules/identity/infrastructure/persistence/drizzle-rate-limiter";
import { authController } from "@/modules/identity/presentation/http/controllers/auth-controller";
import { createEndSessionController } from "@/modules/identity/presentation/http/controllers/end-session-controller";
import { createMergeGuestDraftsController } from "@/modules/identity/presentation/http/controllers/merge-guest-drafts-controller";
import { createRequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { createPageGuards } from "@/modules/identity/presentation/pages/page-guards";
import type { OfferCatalogue } from "@/modules/trips/application/ports/offer-catalogue";
import { OfferSelection } from "@/modules/trips/application/services/offer-selection";
import { ApplyProposal } from "@/modules/trips/application/use-cases/apply-proposal";
import { CreateTrip } from "@/modules/trips/application/use-cases/create-trip";
import { GenerateProposal } from "@/modules/trips/application/use-cases/generate-proposal";
import { GetTrip } from "@/modules/trips/application/use-cases/get-trip";
import { GetWorkspace } from "@/modules/trips/application/use-cases/get-workspace";
import { ListTrips } from "@/modules/trips/application/use-cases/list-trips";
import { LoadOwnedTrip } from "@/modules/trips/application/use-cases/load-owned-trip";
import { SaveWorkspace } from "@/modules/trips/application/use-cases/save-workspace";
import { SuggestProfile } from "@/modules/trips/application/use-cases/suggest-profile";
import { UpdateTripProfile } from "@/modules/trips/application/use-cases/update-trip-profile";
import { DrizzleProposalRepository } from "@/modules/trips/infrastructure/persistence/drizzle-proposal-repository";
import { DrizzleTripRepository } from "@/modules/trips/infrastructure/persistence/drizzle-trip-repository";
import { createIntakeController } from "@/modules/trips/presentation/http/controllers/intake-controller";
import { createCreateTripController } from "@/modules/trips/presentation/http/controllers/create-trip-controller";
import { createGetTripController } from "@/modules/trips/presentation/http/controllers/get-trip-controller";
import { createListTripsController } from "@/modules/trips/presentation/http/controllers/list-trips-controller";
import { createUpdateTripProfileController } from "@/modules/trips/presentation/http/controllers/update-trip-profile-controller";
import { createApplyProposalController } from "@/modules/trips/presentation/http/controllers/apply-proposal-controller";
import { createGenerateProposalController } from "@/modules/trips/presentation/http/controllers/generate-proposal-controller";
import { createGetWorkspaceController } from "@/modules/trips/presentation/http/controllers/get-workspace-controller";
import { createSaveWorkspaceController } from "@/modules/trips/presentation/http/controllers/save-workspace-controller";
import { createOwnedTripLoader } from "@/modules/trips/presentation/http/owned-trip";

// Infrastructure. Repositories receive the lazy client, so nothing connects
// until the first request.
const sessions = new BetterAuthSessionReader();
const guestSessions = new DrizzleGuestSessionRepository(db);
const catalogueRepository = new DrizzleCatalogueRepository(db);
const tripRepository = new DrizzleTripRepository(db);

// Identity
const resolveActor = new ResolveActor(sessions, new DrizzleActorRepository(db));
const guards = createRequestGuards({
  resolveActor,
  throttle: new ThrottleRequest(new DrizzleRateLimiter(db)),
  allowedOrigins,
});

// Catalogue, and the narrow views of it other modules depend on.
const listPublished = new ListPublishedExperiences(catalogueRepository);
const offers: OfferCatalogue = { listPublished: () => listPublished.execute() };
const publishedOffers = {
  ids: async () =>
    new Set((await listPublished.execute()).map((e) => e.offer.id)),
};

// Trips
const selection = new OfferSelection(offers);
const proposals = new DrizzleProposalRepository(db);
const ownedTrip = createOwnedTripLoader(
  guards,
  new LoadOwnedTrip(tripRepository),
);

export const api = {
  auth: authController,
  session: {
    end: createEndSessionController(
      guards,
      new EndSession(guestSessions, sessions, resolveActor),
    ),
  },
  account: {
    mergeGuestDrafts: createMergeGuestDraftsController(
      guards,
      new MergeGuestDrafts(guestSessions),
    ),
  },
  experiences: {
    list: createListExperiencesController(listPublished),
    get: createGetExperienceController(
      new GetPublishedExperience(listPublished),
    ),
  },
  adminCatalogue: {
    list: createListCatalogueRecordsController(
      guards,
      new ListCatalogueRecords(catalogueRepository),
    ),
    create: createCreateCatalogueDraftController(
      guards,
      new CreateCatalogueDraft(catalogueRepository),
    ),
    update: createUpdateCatalogueRecordController(
      guards,
      new UpdateCatalogueRecord(catalogueRepository),
    ),
  },
  bucket: {
    get: createGetBucketController(
      guards,
      new GetBucket(new DrizzleBucketRepository(db)),
    ),
    save: createSaveBucketController(
      guards,
      new SaveBucket(new DrizzleBucketRepository(db), publishedOffers),
    ),
  },
  intake: createIntakeController(guards, new SuggestProfile()),
  trips: {
    list: createListTripsController(guards, new ListTrips(tripRepository)),
    create: createCreateTripController(
      guards,
      new CreateTrip(tripRepository, selection),
    ),
    get: createGetTripController(guards, new GetTrip(tripRepository)),
    updateProfile: createUpdateTripProfileController(
      guards,
      new UpdateTripProfile(tripRepository, offers, selection),
    ),
    getWorkspace: createGetWorkspaceController(
      ownedTrip,
      new GetWorkspace(offers),
    ),
    saveWorkspace: createSaveWorkspaceController(
      guards,
      ownedTrip,
      new SaveWorkspace(tripRepository, offers),
    ),
    generateProposal: createGenerateProposalController(
      guards,
      ownedTrip,
      new GenerateProposal(proposals, offers, selection),
    ),
    applyProposal: createApplyProposalController(
      guards,
      ownedTrip,
      new ApplyProposal(proposals, offers),
    ),
  },
};

// What server-rendered pages may call directly, without an HTTP round trip.
export const pages = {
  ...createPageGuards(sessions),
  requireAdmin: guards.requireAdmin,
  listPublishedExperiences: () => listPublished.execute(),
};
