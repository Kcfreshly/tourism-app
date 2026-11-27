import { randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import {
  draftRecord,
  toPublishedExperience,
  type Experience,
} from "@/modules/catalogue/domain/experience";
import { listingDetails } from "@/modules/catalogue/domain/listing-details";
import { draftPackage } from "@/modules/catalogue/domain/packages";
import type { Partner, ProductType } from "../../domain/partner";
import type { ListingCatalogue } from "../ports/listing-catalogue";
import type { PartnerRepository } from "../ports/partner-repository";

// A new activity drafted by a partner: the staff template, run by them.
function draftExperience(id: string, name: string, operator: string) {
  const record = draftRecord(id, name) as Experience;
  const d = listingDetails(
    toPublishedExperience({ id, seedKey: `partner-${id}`, record }),
  );
  record.details = {
    operator,
    venue: d.venue,
    arrival: d.arrival,
    pickupRateMinor: d.pickupRateMinor,
    childRateMinor: d.childRateMinor,
    confirmation: "PARTNER",
    partnerHours: 24,
    freeCancellationHours: d.freeCancellationHours,
  };
  return record;
}

// Starts a draft of a new listing or trip, or a change to one of the
// partner's live ones. A live listing has at most one open change; asking
// again returns it.
export class StartSubmission {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly catalogue: ListingCatalogue,
  ) {}

  async execute(command: {
    actorId: string;
    partner: Partner;
    productType: ProductType;
    name?: string;
    productId?: string;
  }) {
    const { partner, productType } = command;
    if (command.productId) {
      const live = await this.catalogue.find(productType, command.productId);
      if (!live || live.partnerId !== partner.id)
        throw new AppError(
          "NOT_FOUND",
          "NOT_FOUND",
          "Listing not found among yours.",
        );
      const open = await this.partners.openSubmissionFor(live.productId);
      if (open) return open;
      return this.partners.createSubmission(
        {
          id: randomUUID(),
          partnerId: partner.id,
          productType,
          productId: live.productId,
          baseVersion: live.version,
          name: live.name,
          proposed: live.record,
          createdBy: command.actorId,
        },
        {
          actorId: command.actorId,
          action: "SUBMISSION_STARTED",
          details: { productType, productId: live.productId, edit: true },
        },
      );
    }
    const name = command.name?.trim() ?? "";
    if (name.length < 5 || name.length > 100)
      throw new AppError(
        "INVALID",
        "INVALID_NAME",
        "Enter a name of 5–100 characters.",
      );
    const id = randomUUID();
    const proposed =
      productType === "EXPERIENCE"
        ? draftExperience(id, name, partner.businessName)
        : {
            // A placeholder slug; the trip gets its real one when approved.
            ...draftPackage(`draft-${id.slice(0, 8)}`, name),
            operator: partner.businessName,
          };
    return this.partners.createSubmission(
      {
        id,
        partnerId: partner.id,
        productType,
        productId: null,
        baseVersion: null,
        name:
          productType === "EXPERIENCE" ? (proposed as Experience).name : name,
        proposed,
        createdBy: command.actorId,
      },
      {
        actorId: command.actorId,
        action: "SUBMISSION_STARTED",
        details: { productType, name },
      },
    );
  }
}
