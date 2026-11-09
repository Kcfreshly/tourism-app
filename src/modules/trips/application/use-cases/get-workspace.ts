import { assess } from "../../domain/planner";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { TripContext } from "./load-owned-trip";

// The saved trip, current supply and a freshly calculated price.
export class GetWorkspace {
  constructor(private readonly offers: OfferCatalogue) {}

  async execute(context: TripContext) {
    const offers = await this.offers.listPublished();
    return {
      trip: context.trip,
      offers,
      price: assess(context.profile, context.items, context.services, offers),
    };
  }
}
