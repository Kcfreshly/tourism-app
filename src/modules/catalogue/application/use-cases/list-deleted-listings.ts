import type { CatalogueRepository } from "../ports/catalogue-repository";

// Listings that were deleted and not restored, with who deleted them and why.
export class ListDeletedListings {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute() {
    return (await this.catalogue.deleted()).map(({ snapshot, ...d }) => ({
      ...d,
      id: snapshot.id,
      seedKey: snapshot.seedKey,
      status: snapshot.status,
      name: (snapshot.record as { name?: string }).name ?? snapshot.seedKey,
    }));
  }
}
