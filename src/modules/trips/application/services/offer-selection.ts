import { AppError } from "@/shared/application/app-error";
import type { OfferCatalogue } from "../ports/offer-catalogue";

export class OfferSelection {
  constructor(private readonly offers: OfferCatalogue) {}

  // Refuses duplicates and offers that are not published, except ones the
  // trip already held.
  async validate(ids: string[], retained: string[] = []) {
    if (!ids.length) return;
    const available = await this.publishedIds();
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !available.has(id) && !retained.includes(id))
    )
      throw new AppError(
        "INVALID",
        "INVALID_OFFER",
        "Choose a currently published demo experience.",
      );
  }

  // Drops offers unpublished since they were saved, rather than refusing.
  async keepPublished(ids: string[]) {
    if (!ids.length) return [];
    const available = await this.publishedIds();
    return [...new Set(ids)].filter((id) => available.has(id));
  }

  private async publishedIds() {
    return new Set((await this.offers.listPublished()).map((e) => e.offer.id));
  }
}
