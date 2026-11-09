import type { CatalogueRepository } from "../ports/catalogue-repository";

// Staff view: every row, including drafts and paused listings.
export class ListCatalogueRecords {
  constructor(private readonly catalogue: CatalogueRepository) {}

  execute() {
    return this.catalogue.listAll();
  }
}
