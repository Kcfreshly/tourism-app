import type { CatalogueRepository } from "../ports/catalogue-repository";

// Read-only: every audit event about one listing, newest first. Snapshots are
// left out to keep the response small; restoring reads them on the server.
export class ListCatalogueHistory {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(entityId: string) {
    return (await this.catalogue.history(entityId)).map((e) => {
      const { snapshot, ...details } = e.details as {
        snapshot?: { version?: number; status?: string };
      } & Record<string, unknown>;
      return {
        ...e,
        details,
        version: snapshot?.version ?? null,
        status: snapshot?.status ?? null,
      };
    });
  }
}
