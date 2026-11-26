// Composition root: the only place that creates infrastructure and hands it to
// use cases and controllers. Route files and server pages import from here.
import { cookies } from "next/headers";
import type { Viewer } from "@/modules/bookings/domain/checkout";
import {
  guestKeyCookie,
  guestKeyHash,
} from "@/modules/bookings/presentation/http/guest-key";
import {
  allowedOrigins,
  kemiSettings,
  emailSettings,
  paymentSettings,
  publicAppUrl,
} from "@/config/environment";
import { AppError } from "@/shared/application/app-error";
import type { BookableCatalogue } from "@/modules/bookings/application/ports/bookable-catalogue";
import type { PaymentGateway } from "@/modules/bookings/application/ports/payment-gateway";
import { CartPricing } from "@/modules/bookings/application/services/cart-pricing";
import {
  GetCart,
  QuoteCart,
  SaveCart,
} from "@/modules/bookings/application/use-cases/cart";
import {
  ConfirmOwnPayment,
  ConfirmPayment,
} from "@/modules/bookings/application/use-cases/confirm-payment";
import {
  GetOrder,
  ListOrders,
} from "@/modules/bookings/application/use-cases/orders";
import { RecordPaymentEvent } from "@/modules/bookings/application/use-cases/record-payment-event";
import {
  ExpireOverdueServices,
  ListServiceQueue,
  UpdateServiceRequest,
} from "@/modules/bookings/application/use-cases/service-requests";
import { DrizzleServiceRequestRepository } from "@/modules/bookings/infrastructure/persistence/drizzle-service-request-repository";
import { createServiceRequestControllers } from "@/modules/bookings/presentation/http/controllers/service-request-controllers";
import { SimulatedPayment } from "@/modules/bookings/application/use-cases/simulated-payment";
import { StartCheckout } from "@/modules/bookings/application/use-cases/start-checkout";
import { StartTripCheckout } from "@/modules/bookings/application/use-cases/start-trip-checkout";
import { PaymentStarter } from "@/modules/bookings/application/services/payment-starter";
import type { TripSource } from "@/modules/bookings/application/ports/trip-source";
import type { TripBookings } from "@/modules/trips/application/ports/trip-bookings";
import { LogNotifier } from "@/modules/bookings/infrastructure/notifications/log-notifier";
import { ReceiptNotifier } from "@/modules/bookings/infrastructure/notifications/receipt-notifier";
import {
  DisabledMailer,
  OutboxMailer,
  ResendMailer,
} from "@/modules/bookings/infrastructure/email/mailers";
import type { Mailer } from "@/modules/bookings/application/ports/mailer";
import { OrderLinks } from "@/modules/bookings/application/services/order-links";
import { SendOrderReceipt } from "@/modules/bookings/application/use-cases/order-receipt";
import { authSecret } from "@/modules/identity/infrastructure/auth/better-auth";
import {
  PaystackGateway,
  paystackSignatureValid,
} from "@/modules/bookings/infrastructure/payments/paystack-gateway";
import { SimulatedGateway } from "@/modules/bookings/infrastructure/payments/simulated-gateway";
import { DrizzleCartRepository } from "@/modules/bookings/infrastructure/persistence/drizzle-cart-repository";
import { DrizzleCheckoutRepository } from "@/modules/bookings/infrastructure/persistence/drizzle-checkout-repository";
import { createCartControllers } from "@/modules/bookings/presentation/http/controllers/cart-controllers";
import {
  createOrderControllers,
  createPaystackWebhookController,
  createSimulatedPaymentController,
  createStartCheckoutController,
  createStartTripCheckoutController,
  createVerifyPaymentController,
} from "@/modules/bookings/presentation/http/controllers/checkout-controllers";
import { toPublishedExperience } from "@/modules/catalogue/domain/experience";
import { db } from "@/database/client";
import { GetBucket } from "@/modules/bucket/application/use-cases/get-bucket";
import { SaveBucket } from "@/modules/bucket/application/use-cases/save-bucket";
import { DrizzleBucketRepository } from "@/modules/bucket/infrastructure/persistence/drizzle-bucket-repository";
import { createGetBucketController } from "@/modules/bucket/presentation/http/controllers/get-bucket-controller";
import { createSaveBucketController } from "@/modules/bucket/presentation/http/controllers/save-bucket-controller";
import { CreateCatalogueDraft } from "@/modules/catalogue/application/use-cases/create-catalogue-draft";
import { DeleteCatalogueRecord } from "@/modules/catalogue/application/use-cases/delete-catalogue-record";
import { ListCatalogueHistory } from "@/modules/catalogue/application/use-cases/list-catalogue-history";
import { ListDeletedListings } from "@/modules/catalogue/application/use-cases/list-deleted-listings";
import { RestoreCatalogueRecord } from "@/modules/catalogue/application/use-cases/restore-catalogue-record";
import {
  createDeleteCatalogueRecordController,
  createListCatalogueHistoryController,
  createListDeletedListingsController,
  createRestoreCatalogueRecordController,
} from "@/modules/catalogue/presentation/http/controllers/catalogue-recovery-controllers";
import { GetPublishedExperience } from "@/modules/catalogue/application/use-cases/get-published-experience";
import { ListCatalogueRecords } from "@/modules/catalogue/application/use-cases/list-catalogue-records";
import { ListPublishedExperiences } from "@/modules/catalogue/application/use-cases/list-published-experiences";
import { UpdateCatalogueRecord } from "@/modules/catalogue/application/use-cases/update-catalogue-record";
import { DrizzleCatalogueRepository } from "@/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository";
import { CreatePackageDraft } from "@/modules/catalogue/application/use-cases/create-package-draft";
import { ListPackageRecords } from "@/modules/catalogue/application/use-cases/list-package-records";
import { ListPublishedPackages } from "@/modules/catalogue/application/use-cases/list-published-packages";
import { UpdatePackage } from "@/modules/catalogue/application/use-cases/update-package";
import { UploadImage } from "@/modules/catalogue/application/use-cases/upload-image";
import { DrizzleMediaRepository } from "@/modules/catalogue/infrastructure/persistence/drizzle-media-repository";
import {
  createGetImageHandler,
  createUploadImageController,
} from "@/modules/catalogue/presentation/http/controllers/media-controllers";
import { DrizzlePackageRepository } from "@/modules/catalogue/infrastructure/persistence/drizzle-package-repository";
import {
  createCreatePackageDraftController,
  createListPackageRecordsController,
  createListPackagesController,
  createUpdatePackageController,
} from "@/modules/catalogue/presentation/http/controllers/package-controllers";
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
import { FetchKemiGateway } from "@/modules/kemi/infrastructure/http/fetch-kemi-gateway";
import { createKemiProxyController } from "@/modules/kemi/presentation/http/controllers/kemi-proxy-controller";
import { createPageGuards } from "@/modules/identity/presentation/pages/page-guards";
import type { OfferCatalogue } from "@/modules/trips/application/ports/offer-catalogue";
import { OfferSelection } from "@/modules/trips/application/services/offer-selection";
import { ApplyProposal } from "@/modules/trips/application/use-cases/apply-proposal";
import { CreateTrip } from "@/modules/trips/application/use-cases/create-trip";
import { DeleteTrip } from "@/modules/trips/application/use-cases/delete-trip";
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
import { DrizzleTransportSettingsRepository } from "@/modules/trips/infrastructure/persistence/drizzle-transport-settings-repository";
import { GetTransportSettings } from "@/modules/trips/application/use-cases/get-transport-settings";
import { UpdateTransportSettings } from "@/modules/trips/application/use-cases/update-transport-settings";
import {
  createGetTransportSettingsController,
  createUpdateTransportSettingsController,
} from "@/modules/trips/presentation/http/controllers/transport-settings-controllers";
import { createIntakeController } from "@/modules/trips/presentation/http/controllers/intake-controller";
import { createCreateTripController } from "@/modules/trips/presentation/http/controllers/create-trip-controller";
import { createDeleteTripController } from "@/modules/trips/presentation/http/controllers/delete-trip-controller";
import { createGetTripController } from "@/modules/trips/presentation/http/controllers/get-trip-controller";
import { createListTripsController } from "@/modules/trips/presentation/http/controllers/list-trips-controller";
import { createUpdateTripProfileController } from "@/modules/trips/presentation/http/controllers/update-trip-profile-controller";
import { createApplyProposalController } from "@/modules/trips/presentation/http/controllers/apply-proposal-controller";
import { createGenerateProposalController } from "@/modules/trips/presentation/http/controllers/generate-proposal-controller";
import { createGetWorkspaceController } from "@/modules/trips/presentation/http/controllers/get-workspace-controller";
import { createSaveWorkspaceController } from "@/modules/trips/presentation/http/controllers/save-workspace-controller";
import { createOwnedTripLoader } from "@/modules/trips/presentation/http/owned-trip";
import {
  PublishPartnerExperience,
  PublishPartnerPackage,
} from "@/modules/catalogue/application/use-cases/publish-partner-listing";
import type {
  CatalogueRecord,
  Experience,
} from "@/modules/catalogue/domain/experience";
import type { PackageRecord } from "@/modules/catalogue/domain/packages";
import { isAdmin } from "@/modules/identity/domain/actor";
import type {
  ListingCatalogue,
  LiveListing,
} from "@/modules/partners/application/ports/listing-catalogue";
import { PartnerAccess } from "@/modules/partners/application/services/partner-access";
import { ApplyAsPartner } from "@/modules/partners/application/use-cases/apply-as-partner";
import {
  DecidePartner,
  ListPartners,
} from "@/modules/partners/application/use-cases/decide-partner";
import {
  DecideSubmission,
  ListSubmissionQueue,
} from "@/modules/partners/application/use-cases/decide-submission";
import { ListPartnerListings } from "@/modules/partners/application/use-cases/list-partner-listings";
import {
  GetPartnerDashboard,
  RecordListingVisit,
} from "@/modules/partners/application/use-cases/partner-dashboard";
import {
  SaveSubmission,
  WithdrawSubmission,
} from "@/modules/partners/application/use-cases/save-submission";
import { StartSubmission } from "@/modules/partners/application/use-cases/start-submission";
import {
  AcceptPartnerInvite,
  CreatePartnerInvite,
  ListPartnerInvites,
  RevokePartnerInvite,
  ViewPartnerInvite,
} from "@/modules/partners/application/use-cases/partner-invites";
import { DrizzleListingStatsRepository } from "@/modules/partners/infrastructure/persistence/drizzle-listing-stats-repository";
import { DrizzlePartnerRepository } from "@/modules/partners/infrastructure/persistence/drizzle-partner-repository";
import {
  createAdminPartnerControllers,
  createPartnerControllers,
  createPartnerInviteControllers,
  createRecordVisitController,
} from "@/modules/partners/presentation/http/controllers/partner-controllers";

// Infrastructure. Repositories receive the lazy client, so nothing connects
// until the first request.
const sessions = new BetterAuthSessionReader();
const guestSessions = new DrizzleGuestSessionRepository(db);
const catalogueRepository = new DrizzleCatalogueRepository(db);
const packageRepository = new DrizzlePackageRepository(db);
const mediaRepository = new DrizzleMediaRepository(db);
const listPublishedPackages = new ListPublishedPackages(packageRepository);
const tripRepository = new DrizzleTripRepository(db);
const transportSettings = new DrizzleTransportSettingsRepository(db);
const getTransportSettings = new GetTransportSettings(transportSettings);

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

// Partners, and the narrow view of the catalogue they need.
const partnerRepository = new DrizzlePartnerRepository(db);
const listingStats = new DrizzleListingStatsRepository(db);
const partnerAccess = new PartnerAccess(partnerRepository);
const liveExperience = (r: CatalogueRecord): LiveListing => ({
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
const livePackage = (r: PackageRecord): LiveListing => ({
  productType: "PACKAGE",
  productId: r.id,
  name: r.record.title,
  status: r.status,
  version: r.version,
  slug: r.slug,
  partnerId: r.partnerId ?? null,
  record: r.record,
});
const publishPartnerExperience = new PublishPartnerExperience(
  catalogueRepository,
);
const publishPartnerPackage = new PublishPartnerPackage(packageRepository);
const listingCatalogue: ListingCatalogue = {
  async owned(partnerId) {
    const [listings, trips] = await Promise.all([
      catalogueRepository.listAll(),
      packageRepository.listAll(),
    ]);
    return [
      ...listings.filter((r) => r.partnerId === partnerId).map(liveExperience),
      ...trips.filter((r) => r.partnerId === partnerId).map(livePackage),
    ];
  },
  async find(productType, productId) {
    if (productType === "EXPERIENCE") {
      const row = (await catalogueRepository.listAll()).find(
        (r) => r.id === productId,
      );
      return row ? liveExperience(row) : null;
    }
    const row = (await packageRepository.listAll()).find(
      (r) => r.id === productId,
    );
    return row ? livePackage(row) : null;
  },
  approveExperience: (command) => publishPartnerExperience.execute(command),
  approvePackage: (command) => publishPartnerPackage.execute(command),
};
const partnerApi = createPartnerControllers({
  guards,
  access: partnerAccess,
  apply: new ApplyAsPartner(partnerRepository),
  listings: new ListPartnerListings(partnerRepository, listingCatalogue),
  start: new StartSubmission(partnerRepository, listingCatalogue),
  save: new SaveSubmission(partnerRepository),
  withdraw: new WithdrawSubmission(partnerRepository),
  dashboard: new GetPartnerDashboard(
    partnerRepository,
    listingCatalogue,
    listingStats,
  ),
});
const viewPartnerInvite = new ViewPartnerInvite(partnerRepository);

// Bookings, and the narrow view of the catalogue and partners they need:
// published products run by Fastlife or a verified partner.
const bookableCatalogue: BookableCatalogue = {
  async load() {
    const [listings, trips, partners] = await Promise.all([
      catalogueRepository.listPublished(),
      packageRepository.listPublished(),
      partnerRepository.list(),
    ]);
    const verified = new Set(
      partners.filter((p) => p.status === "VERIFIED").map((p) => p.id),
    );
    const sellable = (partnerId?: string | null) =>
      !partnerId || verified.has(partnerId);
    return [
      ...listings
        .filter((r) => sellable(r.partnerId))
        .map((r) => ({
          kind: "EXPERIENCE" as const,
          productId: r.id,
          partnerId: r.partnerId ?? null,
          listing: toPublishedExperience(r),
        })),
      ...trips
        .filter((r) => sellable(r.partnerId))
        .map((r) => ({
          kind: "PACKAGE" as const,
          productId: r.slug,
          partnerId: r.partnerId ?? null,
          trip: r.record,
        })),
    ];
  },
};
const checkoutRepository = new DrizzleCheckoutRepository(db);
const cartRepository = new DrizzleCartRepository(db);
const cartPricing = new CartPricing(bookableCatalogue, checkoutRepository);
const simulatedGateway = new SimulatedGateway();
const paymentProvider = () => paymentSettings().provider;
function paymentGateway(): PaymentGateway {
  const settings = paymentSettings();
  if (settings.provider === "paystack")
    return new PaystackGateway(settings.secretKey);
  if (settings.provider === "simulated") return simulatedGateway;
  throw new AppError(
    "FORBIDDEN",
    "PAYMENTS_DISABLED",
    "Payments aren’t switched on in this preview.",
  );
}
// Confirmation emails. A misconfigured provider fails that send (logged),
// never the payment.
function mailer(): Mailer {
  const settings = emailSettings();
  if (settings.provider === "resend")
    return new ResendMailer(settings.apiKey, settings.from);
  if (settings.provider === "outbox") return new OutboxMailer();
  return new DisabledMailer();
}
const orderLinks = new OrderLinks(authSecret, publicAppUrl);
const notifier = new ReceiptNotifier(
  new LogNotifier(),
  new SendOrderReceipt(checkoutRepository, mailer, orderLinks),
);
const confirmPayment = new ConfirmPayment(
  checkoutRepository,
  paymentGateway,
  notifier,
);
const serviceRequests = new DrizzleServiceRequestRepository(db);
const expireOverdueServices = new ExpireOverdueServices(
  serviceRequests,
  notifier,
);
const confirmOwnPayment = new ConfirmOwnPayment(
  checkoutRepository,
  confirmPayment,
);
const simulatedPayment = new SimulatedPayment(
  checkoutRepository,
  simulatedGateway,
  () => paymentProvider() === "simulated",
);
const paymentStarter = new PaymentStarter(
  checkoutRepository,
  paymentGateway,
  () => `${publicAppUrl()}/checkout/return`,
);
const paymentsOn = () => paymentProvider() !== "disabled";
const listOrders = new ListOrders(checkoutRepository, expireOverdueServices);
const getOrder = new GetOrder(
  checkoutRepository,
  expireOverdueServices,
  orderLinks,
);

// Trips
const selection = new OfferSelection(offers);
const proposals = new DrizzleProposalRepository(db);
// What trip checkout reads: the traveller's own trip, freshly priced.
// Which order paid for a trip: what makes it read-only.
const tripBookings: TripBookings = {
  orderFor: async (tripId) =>
    (await checkoutRepository.ordersForTrips([tripId])).get(tripId) ?? null,
  ordersFor: (tripIds) => checkoutRepository.ordersForTrips(tripIds),
};
const loadOwnedTrip = new LoadOwnedTrip(tripRepository, tripBookings);
const getWorkspace = new GetWorkspace(offers, transportSettings);
const tripSource: TripSource = {
  async load(userId, tripId) {
    const context = await loadOwnedTrip.execute(tripId, {
      id: userId,
      kind: "ACCOUNT",
    });
    const { price, pickup } = await getWorkspace.execute(context);
    return {
      id: context.trip.id,
      version: context.trip.version,
      profile: context.profile,
      items: context.items,
      services: context.services,
      price,
      blockers: price.blockers,
      orderReference: context.booking?.orderReference ?? null,
      pickupOverdue: !!pickup?.overdue,
    };
  },
};
const ownedTrip = createOwnedTripLoader(guards, loadOwnedTrip);

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
    remove: createDeleteCatalogueRecordController(
      guards,
      new DeleteCatalogueRecord(catalogueRepository),
    ),
    deleted: createListDeletedListingsController(
      guards,
      new ListDeletedListings(catalogueRepository),
    ),
    restore: createRestoreCatalogueRecordController(
      guards,
      new RestoreCatalogueRecord(catalogueRepository),
    ),
    history: createListCatalogueHistoryController(
      guards,
      new ListCatalogueHistory(catalogueRepository),
    ),
  },
  media: {
    upload: createUploadImageController(
      guards,
      new UploadImage(mediaRepository),
    ),
    get: createGetImageHandler(mediaRepository),
    partnerUpload: createUploadImageController(
      guards,
      new UploadImage(mediaRepository),
      partnerApi.authorizeUpload,
    ),
  },
  partner: partnerApi,
  adminPartners: createAdminPartnerControllers({
    guards,
    list: new ListPartners(partnerRepository),
    decide: new DecidePartner(partnerRepository),
    queue: new ListSubmissionQueue(partnerRepository, listingCatalogue),
    decideSubmission: new DecideSubmission(partnerRepository, listingCatalogue),
  }),
  partnerInvites: createPartnerInviteControllers({
    guards,
    create: new CreatePartnerInvite(partnerRepository, publicAppUrl),
    list: new ListPartnerInvites(partnerRepository),
    revoke: new RevokePartnerInvite(partnerRepository),
    accept: new AcceptPartnerInvite(partnerRepository),
  }),
  views: createRecordVisitController({
    guards,
    access: partnerAccess,
    record: new RecordListingVisit(listingStats),
    isStaff: isAdmin,
  }),
  packages: {
    list: createListPackagesController(listPublishedPackages),
  },
  adminPackages: {
    list: createListPackageRecordsController(
      guards,
      new ListPackageRecords(packageRepository),
    ),
    create: createCreatePackageDraftController(
      guards,
      new CreatePackageDraft(packageRepository),
    ),
    update: createUpdatePackageController(
      guards,
      new UpdatePackage(packageRepository),
    ),
  },
  adminTransportSettings: {
    get: createGetTransportSettingsController(guards, getTransportSettings),
    update: createUpdateTransportSettingsController(
      guards,
      new UpdateTransportSettings(transportSettings),
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
  cart: createCartControllers({
    guards,
    get: new GetCart(cartRepository),
    save: new SaveCart(cartRepository),
    quote: new QuoteCart(cartPricing),
  }),
  checkouts: {
    start: createStartCheckoutController({
      guards,
      start: new StartCheckout(cartPricing, checkoutRepository, paymentStarter),
      enabled: paymentsOn,
    }),
    trip: createStartTripCheckoutController({
      guards,
      start: new StartTripCheckout(
        tripSource,
        bookableCatalogue,
        checkoutRepository,
        paymentStarter,
      ),
      enabled: paymentsOn,
    }),
  },
  payments: {
    paystackWebhook: createPaystackWebhookController({
      record: new RecordPaymentEvent(checkoutRepository, confirmPayment),
      signatureValid: (raw, signature) => {
        const settings = paymentSettings();
        return (
          settings.provider === "paystack" &&
          paystackSignatureValid(settings.secretKey, raw, signature)
        );
      },
    }),
    verify: createVerifyPaymentController({
      guards,
      confirm: confirmOwnPayment,
    }),
    simulated: createSimulatedPaymentController({
      guards,
      simulated: simulatedPayment,
    }),
  },
  adminServiceRequests: createServiceRequestControllers({
    guards,
    list: new ListServiceQueue(serviceRequests, expireOverdueServices),
    update: new UpdateServiceRequest(serviceRequests, notifier),
  }),
  orders: createOrderControllers({ guards, list: listOrders, get: getOrder }),
  intake: createIntakeController(guards, new SuggestProfile()),
  trips: {
    list: createListTripsController(
      guards,
      new ListTrips(tripRepository, tripBookings),
    ),
    create: createCreateTripController(
      guards,
      new CreateTrip(tripRepository, selection),
    ),
    get: createGetTripController(guards, new GetTrip(tripRepository)),
    updateProfile: createUpdateTripProfileController(
      guards,
      new UpdateTripProfile(tripRepository, offers, selection, tripBookings),
    ),
    remove: createDeleteTripController(
      guards,
      new DeleteTrip(tripRepository, tripBookings),
    ),
    getWorkspace: createGetWorkspaceController(ownedTrip, getWorkspace),
    saveWorkspace: createSaveWorkspaceController(
      guards,
      ownedTrip,
      new SaveWorkspace(tripRepository, offers, transportSettings),
    ),
    generateProposal: createGenerateProposalController(
      guards,
      ownedTrip,
      new GenerateProposal(proposals, offers, selection, transportSettings),
    ),
    applyProposal: createApplyProposalController(
      guards,
      ownedTrip,
      new ApplyProposal(proposals, offers, transportSettings),
    ),
  },
  kemi: {
    proxy: createKemiProxyController(
      guards,
      new FetchKemiGateway(kemiSettings().url),
      () => kemiSettings().enabled,
    ),
  },
};

// What server-rendered pages may call directly, without an HTTP round trip.
export const pages = {
  ...createPageGuards(sessions),
  requireAdmin: guards.requireAdmin,
  currentActor: guards.currentActor,
  partnerFor: (userId: string) => partnerAccess.membership(userId),
  partnerInvite: (token: string) => viewPartnerInvite.execute(token),
  listPublishedExperiences: () => listPublished.execute(),
  listPublishedPackages: () => listPublishedPackages.execute(),
  publishedPackage: async (slug: string) =>
    (await listPublishedPackages.execute()).find((p) => p.slug === slug),
  transportSettings: async () =>
    (await getTransportSettings.execute()).settings,
  // A misconfigured provider shows as switched off here and fails loudly
  // on Pay instead.
  paymentsEnabled: () => {
    try {
      return paymentProvider() !== "disabled";
    } catch (e) {
      console.error(e);
      return false;
    }
  },
  // The signed-in account and this browser's guest checkout key, either of
  // which may own a payment or order.
  viewer: async (): Promise<Viewer> => ({
    userId: (await guards.currentActor())?.id ?? null,
    guestKeyHash: guestKeyHash((await cookies()).get(guestKeyCookie)?.value),
  }),
  confirmOwnPayment: (viewer: Viewer, reference: string) =>
    confirmOwnPayment.execute(viewer, reference),
  simulatedPayment: (viewer: Viewer, reference: string) =>
    simulatedPayment.view(viewer, reference),
  orders: (viewer: Viewer) => listOrders.execute(viewer),
  order: (viewer: Viewer, reference: string) =>
    getOrder.execute(viewer, reference),
  // The signed link from the confirmation email.
  orderFromLink: (reference: string, key: string | undefined) =>
    getOrder.withLink(reference, key),
  emailOn: () => {
    try {
      return emailSettings().provider !== "disabled";
    } catch {
      return false;
    }
  },
};
