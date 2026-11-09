import { toPublishedExperience } from "../../domain/experience";
import type { CatalogueRepository } from "../ports/catalogue-repository";

// Public supply: only published rows, with display and scheduling defaults.
export class ListPublishedExperiences {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute() {
    return (await this.catalogue.listPublished()).map(toPublishedExperience);
  }
}
