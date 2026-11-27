import { AppError } from "@/shared/application/app-error";
import {
  emptyReview,
  listingReadiness,
  type CatalogueEdit,
} from "@/modules/catalogue/domain/catalogue";
import { lagosToday } from "@/modules/catalogue/domain/events";
import {
  editedRecord,
  type Experience,
} from "@/modules/catalogue/domain/experience";
import {
  packageReadiness,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import { openSubmissionStatuses, type Partner } from "../../domain/partner";
import type { PartnerRepository } from "../ports/partner-repository";

// Saves a partner's draft, and with `submit` sends it to staff for review.
// Saving one that is in review takes it back out until it is sent again.
// Partners never set the publication status, the review checklist or the
// night-time security review; staff decide those.
export class SaveSubmission {
  constructor(private readonly partners: PartnerRepository) {}

  async execute(command: {
    actorId: string;
    partner: Partner;
    id: string;
    expectedVersion: number;
    submit: boolean;
    experience?: CatalogueEdit;
    trip?: TripPackage;
  }) {
    const current = await this.partners.findSubmission(command.id);
    if (!current || current.partnerId !== command.partner.id)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    if (!openSubmissionStatuses.includes(current.status))
      throw new AppError(
        "CONFLICT",
        "NOT_EDITABLE",
        "This submission is closed. Start a new change from the live listing.",
      );
    let proposed: Experience | TripPackage;
    let missing: string[];
    if (current.productType === "EXPERIENCE") {
      if (!command.experience)
        throw new AppError("INVALID", "INVALID_LISTING", "Send the listing.");
      const old = current.proposed as Experience;
      proposed = editedRecord(old, {
        ...command.experience,
        status: "DRAFT",
        review: emptyReview,
        nightVisitAllowed: undefined,
      });
      // Keep what staff last approved for the night review.
      proposed.nightVisitAllowed = old.nightVisitAllowed;
      missing = listingReadiness(command.experience);
    } else {
      if (!command.trip)
        throw new AppError("INVALID", "INVALID_PACKAGE", "Send the trip.");
      const old = current.proposed as TripPackage;
      proposed = { ...command.trip, slug: old.slug, isDemo: true };
      missing = packageReadiness(proposed, lagosToday());
    }
    if (command.submit && missing.length)
      throw new AppError("INVALID", "NOT_READY", missing.join("; "));
    const name =
      "title" in proposed ? proposed.title : (proposed as Experience).name;
    const changed = await this.partners.updateSubmission(
      {
        id: current.id,
        expectedVersion: command.expectedVersion,
        actorId: command.actorId,
      },
      {
        name,
        proposed,
        status: command.submit ? "PENDING" : "DRAFT",
        // Staff's reason stays visible while the partner works on it.
        reason: command.submit ? null : current.reason,
        submittedAt: command.submit ? new Date() : current.submittedAt,
        audit: {
          action: command.submit ? "SUBMISSION_SUBMITTED" : "SUBMISSION_SAVED",
          details: {
            productType: current.productType,
            productId: current.productId,
          },
        },
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This draft changed in another window. Reload before editing again.",
      );
    return changed;
  }
}

export class WithdrawSubmission {
  constructor(private readonly partners: PartnerRepository) {}

  async execute(command: {
    actorId: string;
    partner: Partner;
    id: string;
    expectedVersion: number;
  }) {
    const current = await this.partners.findSubmission(command.id);
    if (!current || current.partnerId !== command.partner.id)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    if (!openSubmissionStatuses.includes(current.status))
      throw new AppError(
        "CONFLICT",
        "NOT_EDITABLE",
        "This submission is already closed.",
      );
    const changed = await this.partners.updateSubmission(
      {
        id: current.id,
        expectedVersion: command.expectedVersion,
        actorId: command.actorId,
      },
      {
        status: "WITHDRAWN",
        audit: {
          action: "SUBMISSION_WITHDRAWN",
          details: { productId: current.productId },
        },
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This draft changed in another window. Reload and try again.",
      );
    return changed;
  }
}
