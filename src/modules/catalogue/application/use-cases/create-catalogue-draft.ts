import { randomUUID } from "node:crypto";
import { emptyReview } from "../../domain/catalogue";
import { draftRecord } from "../../domain/experience";
import type { CatalogueRepository } from "../ports/catalogue-repository";

export class CreateCatalogueDraft {
  constructor(private readonly catalogue: CatalogueRepository) {}

  execute(command: { actorId: string; name: string }) {
    const id = randomUUID();
    return this.catalogue.createDraft(
      {
        id,
        seedKey: `demo-${id}`,
        status: "DRAFT",
        review: emptyReview,
        record: draftRecord(id, command.name),
      },
      {
        actorId: command.actorId,
        action: "DEMO_CATALOGUE_DRAFT_CREATED",
        details: { isDemo: true },
      },
    );
  }
}
