import type { Experience } from "@/modules/catalogue/domain/experience";
import type { TripPackage } from "@/modules/catalogue/domain/packages";
import type { ProductType } from "../../domain/partner";

// A listing or trip as it is live in the catalogue.
export type LiveListing = {
  productType: ProductType;
  productId: string;
  name: string;
  status: string;
  version: number;
  // Where travellers find it: the experience seed key or the trip slug.
  slug: string;
  // Experiences only: the offer id saved buckets and trip plans refer to.
  offerId?: string;
  partnerId: string | null;
  record: unknown;
};

type Approval<T> = {
  actorId: string;
  submissionId: string;
  partnerId: string;
  productId: string | null;
  record: T;
};

// What the partners module needs from the catalogue, wired up in the
// composition root. Approval goes through the catalogue's own use cases.
export interface ListingCatalogue {
  owned(partnerId: string): Promise<LiveListing[]>;
  find(
    productType: ProductType,
    productId: string,
  ): Promise<LiveListing | null>;
  approveExperience(
    command: Approval<Experience> & { nightVisitAllowed: boolean },
  ): Promise<{ id: string }>;
  approvePackage(command: Approval<TripPackage>): Promise<{ id: string }>;
}
