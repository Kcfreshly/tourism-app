import { randomUUID } from "node:crypto";
import { draftPackage, slugify } from "../../domain/packages";
import type { PackageRepository } from "../ports/package-repository";

export class CreatePackageDraft {
  constructor(private readonly packages: PackageRepository) {}

  // The slug comes from the title and gets a number when it is taken.
  async execute(command: { actorId: string; title: string }) {
    const base = slugify(command.title);
    let slug = base;
    for (let n = 2; await this.packages.slugTaken(slug); n++)
      slug = `${base}-${n}`;
    const id = randomUUID();
    return this.packages.create(
      { id, slug, status: "DRAFT", record: draftPackage(slug, command.title) },
      {
        actorId: command.actorId,
        action: "PACKAGE_DRAFT_CREATED",
        details: { slug, isDemo: true },
      },
    );
  }
}
