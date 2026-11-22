import { AppError } from "@/shared/application/app-error";
import type { CatalogueRepository } from "../ports/catalogue-repository";

// Super admins only (checked by the controller). The listing leaves the
// catalogue, and its last snapshot stays in the append-only audit trail, so
// it can be restored.
export class DeleteCatalogueRecord {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(command: {
    actorId: string;
    id: string;
    expectedVersion: number;
    reason: string | null;
  }) {
    const removed = await this.catalogue.delete(command);
    if (removed === undefined)
      throw new AppError(
        "NOT_FOUND",
        "NOT_FOUND",
        "Catalogue record not found.",
      );
    if (removed === null)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Catalogue changed. Reload before deleting.",
      );
    return { id: removed.id, deleted: true };
  }
}
