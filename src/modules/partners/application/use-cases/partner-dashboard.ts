import { createHash } from "node:crypto";
import { lagosToday } from "@/modules/catalogue/domain/events";
import {
  openSubmissionStatuses,
  periodStart,
  type Partner,
  type ProductType,
} from "../../domain/partner";
import type { ListingCatalogue } from "../ports/listing-catalogue";
import type {
  ListingStatsRepository,
  PartnerRepository,
} from "../ports/partner-repository";

// Counts one view of a listing page or quick view. The browser's random id is
// hashed, so visitors are counted without storing who they are.
export class RecordListingVisit {
  constructor(private readonly stats: ListingStatsRepository) {}

  execute(command: {
    productType: ProductType;
    productId: string;
    visitorKey: string;
  }) {
    return this.stats.recordVisit({
      productType: command.productType,
      productId: command.productId,
      day: lagosToday(),
      visitor: createHash("sha256")
        .update(command.visitorKey)
        .digest("hex")
        .slice(0, 32),
    });
  }
}

// A partner's figures for the last `days` days against the period before.
// Bookings and sales come from checkout, which isn't live yet, so they are
// reported as not available rather than as zero.
export class GetPartnerDashboard {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly catalogue: ListingCatalogue,
    private readonly stats: ListingStatsRepository,
  ) {}

  async execute(partner: Partner, days = 30, today = lagosToday()) {
    const from = periodStart(today, days);
    const prevTo = periodStart(from, 2);
    const prevFrom = periodStart(prevTo, days);
    const [live, submissions] = await Promise.all([
      this.catalogue.owned(partner.id),
      this.partners.submissionsFor(partner.id),
    ]);
    // Trips are counted by slug, which is what their pages know.
    const key = (l: (typeof live)[number]) =>
      l.productType === "PACKAGE" ? l.slug : l.productId;
    const products = live.map((l) => ({
      productType: l.productType,
      productId: key(l),
    }));
    const offerIds = live.flatMap((l) => (l.offerId ? [l.offerId] : []));
    const [current, previous, saves, plans] = await Promise.all([
      this.stats.visits(products, from, today),
      this.stats.visits(products, prevFrom, prevTo),
      this.stats.saves(offerIds),
      this.stats.tripPlans(offerIds),
    ]);
    const byDay = new Map(current.daily.map((d) => [d.day, d.views]));
    const daily = Array.from({ length: days }, (_, i) => {
      const day = periodStart(today, days - i);
      return { day, views: byDay.get(day) ?? 0 };
    });
    const listings = live.map((l) => {
      const visits = current.perProduct.find(
        (v) => v.productType === l.productType && v.productId === key(l),
      );
      return {
        productType: l.productType,
        productId: l.productId,
        name: l.name,
        status: l.status,
        slug: l.slug,
        views: visits?.views ?? 0,
        visitors: visits?.visitors ?? 0,
        saves: l.offerId ? (saves[l.offerId] ?? 0) : null,
        tripPlans: l.offerId ? (plans[l.offerId] ?? 0) : null,
      };
    });
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    const open = submissions.filter((s) =>
      openSubmissionStatuses.includes(s.status),
    );
    return {
      period: { from, to: today, days },
      totals: {
        views: sum(current.perProduct.map((v) => v.views)),
        viewsBefore: sum(previous.perProduct.map((v) => v.views)),
        visitors: current.visitors,
        visitorsBefore: previous.visitors,
        saves: sum(Object.values(saves)),
        tripPlans: sum(Object.values(plans)),
        live: live.filter((l) => l.status === "DEMO_PUBLISHED").length,
        inReview: open.filter((s) => s.status === "PENDING").length,
        changesRequested: open.filter((s) => s.status === "DECLINED").length,
        drafts: open.filter((s) => s.status === "DRAFT").length,
      },
      daily,
      listings: listings.sort((a, b) => b.views - a.views),
      // Filled in once checkout records bookings (docs/PAYMENT_INTEGRATION_PLAN.md).
      sales: null,
    };
  }
}
