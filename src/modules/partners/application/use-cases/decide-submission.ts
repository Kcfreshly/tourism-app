import { AppError } from "@/shared/application/app-error";
import type { Experience } from "@/modules/catalogue/domain/experience";
import type { TripPackage } from "@/modules/catalogue/domain/packages";
import type { ListingCatalogue } from "../ports/listing-catalogue";
import type { PartnerRepository } from "../ports/partner-repository";

// Submissions waiting for staff, oldest first, each with the live version it
// would replace so staff can see what changed.
export class ListSubmissionQueue {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly catalogue: ListingCatalogue,
  ) {}

  async execute() {
    const queue = await this.partners.submissionsWithStatus("PENDING");
    return Promise.all(
      queue.map(async (s) => ({
        ...s,
        live: s.productId
          ? await this.catalogue.find(s.productType, s.productId)
          : null,
      })),
    );
  }
}

// Staff approve a submission, which publishes it (or swaps the change into
// the live listing), or decline it with a reason the partner sees.
export class DecideSubmission {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly catalogue: ListingCatalogue,
  ) {}

  async execute(command: {
    actorId: string;
    id: string;
    expectedVersion: number;
    decision: "APPROVE" | "DECLINE";
    reason?: string;
    nightVisitAllowed?: boolean;
  }) {
    const s = await this.partners.findSubmission(command.id);
    if (!s)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Submission not found.");
    // Checked before publishing, so staff never approve content they
    // haven't seen.
    if (s.status !== "PENDING" || s.version !== command.expectedVersion)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "The partner changed or withdrew this submission. Reload the queue.",
      );
    const write = (
      change: Parameters<PartnerRepository["updateSubmission"]>[1],
    ) =>
      this.partners.updateSubmission(
        {
          id: s.id,
          expectedVersion: s.version,
          actorId: command.actorId,
        },
        change,
      );
    let changed;
    if (command.decision === "DECLINE") {
      changed = await write({
        status: "DECLINED",
        reason: command.reason?.trim() ?? null,
        decidedBy: command.actorId,
        audit: {
          action: "SUBMISSION_DECLINED",
          details: { productId: s.productId, reason: command.reason },
        },
      });
    } else {
      const partner = await this.partners.find(s.partnerId);
      if (partner?.status !== "VERIFIED")
        throw new AppError(
          "CONFLICT",
          "PARTNER_NOT_VERIFIED",
          "Only listings from verified partners can be approved.",
        );
      const approval = {
        actorId: command.actorId,
        submissionId: s.id,
        partnerId: s.partnerId,
        productId: s.productId,
      };
      const live =
        s.productType === "EXPERIENCE"
          ? await this.catalogue.approveExperience({
              ...approval,
              record: s.proposed as Experience,
              nightVisitAllowed:
                command.nightVisitAllowed ??
                (s.proposed as Experience).nightVisitAllowed ??
                false,
            })
          : await this.catalogue.approvePackage({
              ...approval,
              record: s.proposed as TripPackage,
            });
      changed = await write({
        status: "APPROVED",
        productId: live.id,
        reason: null,
        decidedBy: command.actorId,
        audit: {
          action: "SUBMISSION_APPROVED",
          details: { productId: live.id, productType: s.productType },
        },
      });
    }
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "The partner changed this submission meanwhile. Reload the queue.",
      );
    return changed;
  }
}
