import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import {
  itemSchema,
  placementIssues,
  placementMessage,
  servicesSchema,
} from "../../domain/planner";
import { profileSchema, type Profile } from "../../domain/profile";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { TripOwner, TripRepository } from "../ports/trip-repository";
import type { OfferSelection } from "../services/offer-selection";

// Changes dates, party or interests, refusing any change that would make the
// existing schedule invalid.
export class UpdateTripProfile {
  constructor(
    private readonly trips: TripRepository,
    private readonly offers: OfferCatalogue,
    private readonly selection: OfferSelection,
  ) {}

  async execute(command: {
    id: string;
    owner: TripOwner;
    expectedVersion: number;
    profile: Profile;
  }) {
    const { id, owner, expectedVersion, profile } = command;
    const existing = await this.trips.findOwned(id, owner);
    if (!existing)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    await this.selection.validate(
      profile.selectedOfferIds,
      profileSchema.parse(existing.profile).selectedOfferIds,
    );
    const services = servicesSchema.parse(existing.services);
    const issue = placementIssues(
      profile,
      z.array(itemSchema).parse(existing.items),
      services,
      await this.offers.listPublished(),
    )[0];
    if (issue)
      throw new AppError(
        "INVALID",
        issue.code,
        `This profile would invalidate your plan. ${placementMessage(issue)}`,
      );
    const trip = await this.trips.update(id, owner, expectedVersion, {
      profile,
      services: { ...services, assistance: profile.assistance },
    });
    if (!trip)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This draft changed in another tab. Copy your edits, then reload the saved draft.",
      );
    return trip;
  }
}
