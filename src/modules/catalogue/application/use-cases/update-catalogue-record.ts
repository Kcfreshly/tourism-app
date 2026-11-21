import { AppError } from "@/shared/application/app-error";
import {
  catalogueEditIssue,
  nightReviewIssue,
  type CatalogueEdit,
} from "../../domain/catalogue";
import {
  changedFields,
  editedRecord,
  type Experience,
} from "../../domain/experience";
import type { CatalogueRepository } from "../ports/catalogue-repository";

export class UpdateCatalogueRecord {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(command: { actorId: string; edit: CatalogueEdit }) {
    const { edit } = command;
    const changed = await this.catalogue.update(
      {
        id: edit.id,
        expectedVersion: edit.expectedVersion,
        actorId: command.actorId,
      },
      (current) => {
        if (!current)
          throw new AppError(
            "NOT_FOUND",
            "NOT_FOUND",
            "Catalogue record not found.",
          );
        const old = current.record as Experience;
        const issue = catalogueEditIssue(
          { status: current.status, isDemo: old.isDemo },
          edit,
        );
        if (issue) throw new AppError("INVALID", issue.code, issue.message);
        const record = editedRecord(old, edit);
        const night = nightReviewIssue(record, edit.status);
        if (night) throw new AppError("INVALID", night.code, night.message);
        return {
          status: edit.status,
          record,
          review: edit.review,
          audit: {
            action: "DEMO_CATALOGUE_UPDATED",
            details: {
              previousVersion: current.version,
              changed: changedFields(old, record),
              status: edit.status,
              rateMinor: edit.rateMinor,
              capacityPerSlot: edit.capacityPerSlot,
              bookingCutoffHours: edit.bookingCutoffHours,
              review: edit.review,
            },
          },
        };
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Catalogue changed. Reload before editing again.",
      );
    return changed;
  }
}
