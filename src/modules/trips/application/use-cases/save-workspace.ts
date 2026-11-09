import { AppError } from "@/shared/application/app-error";
import {
  assess,
  placementIssues,
  placementMessage,
  type Item,
  type Services,
} from "../../domain/planner";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { TripRepository } from "../ports/trip-repository";
import type { TripContext } from "./load-owned-trip";

// Autosave: validates placement, then saves only if no other tab saved first.
export class SaveWorkspace {
  constructor(
    private readonly trips: TripRepository,
    private readonly offers: OfferCatalogue,
  ) {}

  async execute(
    context: TripContext,
    input: { expectedVersion: number; items: Item[]; services: Services },
  ) {
    const { items, services, expectedVersion } = input;
    const offers = await this.offers.listPublished();
    const issue = placementIssues(context.profile, items, services, offers)[0];
    if (issue)
      throw new AppError("INVALID", issue.code, placementMessage(issue));
    const price = assess(context.profile, items, services, offers);
    const trip = await this.trips.update(
      context.trip.id,
      context.actor,
      expectedVersion,
      {
        items,
        services,
        profile: { ...context.profile, assistance: services.assistance },
      },
    );
    if (!trip)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Draft changed in another tab. Your edits are retained; reload the latest saved plan.",
      );
    return { trip, price };
  }
}
