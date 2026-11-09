import type { PublishedExperience } from "@/modules/catalogue/domain/experience";

// What planning needs from the catalogue module: current published supply.
export interface OfferCatalogue {
  listPublished(): Promise<PublishedExperience[]>;
}
