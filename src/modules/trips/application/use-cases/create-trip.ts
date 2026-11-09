import { randomUUID } from "node:crypto";
import type { Profile } from "../../domain/profile";
import type { OfferSelection } from "../services/offer-selection";
import type { TripOwner, TripRepository } from "../ports/trip-repository";

export class CreateTrip {
  constructor(
    private readonly trips: TripRepository,
    private readonly selection: OfferSelection,
  ) {}

  async execute(owner: TripOwner, input: Profile) {
    // Drop bucket ideas that were unpublished since they were saved, rather
    // than refusing the whole draft.
    const profile = {
      ...input,
      selectedOfferIds: await this.selection.keepPublished(
        input.selectedOfferIds,
      ),
    };
    return this.trips.create({
      id: randomUUID(),
      owner,
      profile,
      services: {
        assistance: profile.assistance,
        vehicleWindows: {},
        guideItemIds: [],
        guideDays: [],
      },
    });
  }
}
