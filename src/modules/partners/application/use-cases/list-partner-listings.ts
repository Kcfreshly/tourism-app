import { openSubmissionStatuses, type Partner } from "../../domain/partner";
import type { ListingCatalogue } from "../ports/listing-catalogue";
import type { PartnerRepository } from "../ports/partner-repository";

// The partner's live listings and trips, each with its open change if any,
// then new ones that haven't been approved yet.
export class ListPartnerListings {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly catalogue: ListingCatalogue,
  ) {}

  async execute(partner: Partner) {
    const [live, submissions] = await Promise.all([
      this.catalogue.owned(partner.id),
      this.partners.submissionsFor(partner.id),
    ]);
    const open = submissions.filter((s) =>
      openSubmissionStatuses.includes(s.status),
    );
    return [
      ...open
        .filter((s) => !s.productId)
        .map((submission) => ({
          productType: submission.productType,
          productId: null,
          name: submission.name,
          live: null,
          submission,
        })),
      ...live.map((l) => ({
        productType: l.productType,
        productId: l.productId,
        name: l.name,
        live: {
          status: l.status,
          version: l.version,
          slug: l.slug,
          record: l.record,
        },
        submission: open.find((s) => s.productId === l.productId) ?? null,
      })),
    ];
  }
}
