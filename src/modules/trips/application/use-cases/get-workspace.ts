import { assess } from "../../domain/planner";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { TransportSettingsRepository } from "../ports/transport-settings-repository";
import type { TripContext } from "./load-owned-trip";

// The saved trip, current supply, the transport rules and a freshly
// calculated price.
export class GetWorkspace {
  constructor(
    private readonly offers: OfferCatalogue,
    private readonly transport: TransportSettingsRepository,
  ) {}

  async execute(context: TripContext) {
    const offers = await this.offers.listPublished();
    const { settings } = await this.transport.get();
    return {
      trip: context.trip,
      offers,
      settings,
      price: assess(
        context.profile,
        context.items,
        context.services,
        offers,
        undefined,
        settings,
      ),
    };
  }
}
