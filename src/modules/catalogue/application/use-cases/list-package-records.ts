import type { PackageRepository } from "../ports/package-repository";

// Staff view: every trip, including drafts and unpublished ones.
export class ListPackageRecords {
  constructor(private readonly packages: PackageRepository) {}

  async execute() {
    return (await this.packages.listAll()).sort((a, b) =>
      a.record.title.localeCompare(b.record.title),
    );
  }
}
