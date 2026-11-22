import { AppError } from "@/shared/application/app-error";
import type { CatalogueRepository } from "../ports/catalogue-repository";

// Any admin may restore: it only ever brings a listing back as it was when
// it was deleted, and the restore is itself audited.
export class RestoreCatalogueRecord {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(command: { actorId: string; auditId: string }) {
    const result = await this.catalogue.restore(command);
    switch (result.kind) {
      case "RESTORED":
        return result.row;
      case "NOT_A_DELETION":
        throw new AppError(
          "NOT_FOUND",
          "NOT_FOUND",
          "No deleted listing found for that audit event.",
        );
      case "ALREADY_LISTED":
        throw new AppError(
          "CONFLICT",
          "ALREADY_LISTED",
          "This listing has already been restored.",
        );
      case "SEED_KEY_TAKEN":
        throw new AppError(
          "CONFLICT",
          "SEED_KEY_TAKEN",
          "Another listing now uses this listing's address. Rename or delete it first.",
        );
    }
  }
}
