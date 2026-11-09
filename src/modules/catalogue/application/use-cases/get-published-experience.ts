import { AppError } from "@/shared/application/app-error";
import type { ListPublishedExperiences } from "./list-published-experiences";

export class GetPublishedExperience {
  constructor(private readonly listPublished: ListPublishedExperiences) {}

  // Accepts the database id or the fixture seed key.
  async execute(id: string) {
    const record = (await this.listPublished.execute()).find(
      (e) => e.id === id || e.seedKey === id,
    );
    if (!record)
      throw new AppError(
        "NOT_FOUND",
        "NOT_FOUND",
        "Published experience not found.",
      );
    return record;
  }
}
