import { AppError } from "@/shared/application/app-error";
import { nightReviewIssue } from "../../domain/catalogue";
import { changedFields, type Experience } from "../../domain/experience";
import { slugify, type TripPackage } from "../../domain/packages";
import type { CatalogueRepository } from "../ports/catalogue-repository";
import type { PackageRepository } from "../ports/package-repository";

// Approving a partner's submission is the staff review, so every check is
// recorded as passed.
const approved = {
  content: true,
  rates: true,
  capacity: true,
  policy: true,
  media: true,
};

type Approval<T> = {
  actorId: string;
  submissionId: string;
  partnerId: string;
  // The live listing an edit replaces; null for a new one, which is created
  // with the submission's id, so a repeated approval updates it instead of
  // making a second one.
  productId: string | null;
  record: T;
};

// A listing staff stopped selling stays stopped after an approved edit.
const liveStatus = (current: string) =>
  current === "PAUSED" ? "PAUSED" : "DEMO_PUBLISHED";

export class PublishPartnerExperience {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(
    command: Approval<Experience> & { nightVisitAllowed: boolean },
  ) {
    const id = command.productId ?? command.submissionId;
    const current = (await this.catalogue.listAll()).find((r) => r.id === id);
    if (command.productId && !current)
      throw new AppError(
        "NOT_FOUND",
        "LISTING_GONE",
        "The live listing this change was made to has been deleted.",
      );
    if (current && current.partnerId !== command.partnerId)
      throw new AppError(
        "FORBIDDEN",
        "NOT_YOUR_LISTING",
        "This listing belongs to someone else.",
      );
    const status = current ? liveStatus(current.status) : "DEMO_PUBLISHED";
    const record: Experience = {
      ...command.record,
      status,
      nightVisitAllowed: command.nightVisitAllowed,
    };
    const night = nightReviewIssue(record, "DEMO_PUBLISHED");
    if (night) throw new AppError("INVALID", night.code, night.message);
    const details = {
      submissionId: command.submissionId,
      partnerId: command.partnerId,
    };
    if (!current)
      return this.catalogue.createDraft(
        {
          id,
          seedKey: `partner-${id}`,
          status,
          review: approved,
          record,
          partnerId: command.partnerId,
        },
        {
          actorId: command.actorId,
          action: "PARTNER_LISTING_APPROVED",
          details,
        },
      );
    const changed = await this.catalogue.update(
      { id, expectedVersion: current.version, actorId: command.actorId },
      () => ({
        status,
        record,
        review: approved,
        audit: {
          action: "PARTNER_EDIT_APPROVED",
          details: {
            ...details,
            previousVersion: current.version,
            changed: changedFields(current.record as Experience, record),
          },
        },
      }),
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "The live listing changed while approving. Try again.",
      );
    return changed;
  }
}

export class PublishPartnerPackage {
  constructor(private readonly packages: PackageRepository) {}

  async execute(command: Approval<TripPackage>) {
    const id = command.productId ?? command.submissionId;
    const current = (await this.packages.listAll()).find((r) => r.id === id);
    if (command.productId && !current)
      throw new AppError(
        "NOT_FOUND",
        "LISTING_GONE",
        "The live trip this change was made to no longer exists.",
      );
    if (current && current.partnerId !== command.partnerId)
      throw new AppError(
        "FORBIDDEN",
        "NOT_YOUR_LISTING",
        "This trip belongs to someone else.",
      );
    const details = {
      submissionId: command.submissionId,
      partnerId: command.partnerId,
    };
    if (!current) {
      // Cart lines refer to the slug, so it is fixed when the trip goes live.
      const base = slugify(command.record.title);
      let slug = base;
      for (let n = 2; await this.packages.slugTaken(slug); n++)
        slug = `${base}-${n}`;
      return this.packages.create(
        {
          id,
          slug,
          status: "DEMO_PUBLISHED",
          record: { ...command.record, slug, isDemo: true },
          partnerId: command.partnerId,
        },
        {
          actorId: command.actorId,
          action: "PARTNER_PACKAGE_APPROVED",
          details: { ...details, slug },
        },
      );
    }
    const changed = await this.packages.update(
      { id, expectedVersion: current.version, actorId: command.actorId },
      () => ({
        status: liveStatus(current.status),
        record: { ...command.record, slug: current.slug, isDemo: true },
        audit: {
          action: "PARTNER_PACKAGE_EDIT_APPROVED",
          details: { ...details, previousVersion: current.version },
        },
      }),
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "The live trip changed while approving. Try again.",
      );
    return changed;
  }
}
