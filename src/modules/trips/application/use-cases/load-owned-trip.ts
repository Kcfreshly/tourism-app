import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { itemSchema, servicesSchema } from "../../domain/planner";
import { profileSchema } from "../../domain/profile";
import type { TripOwner, TripRepository } from "../ports/trip-repository";

export type TripContext = Awaited<ReturnType<LoadOwnedTrip["execute"]>>;

// Loads a trip the actor owns and parses its stored plan.
export class LoadOwnedTrip {
  constructor(private readonly trips: TripRepository) {}

  async execute(id: string, actor: TripOwner) {
    const trip = await this.trips.findOwned(id, actor);
    if (!trip) throw new AppError("NOT_FOUND", "NOT_FOUND", "Trip not found.");
    return {
      actor,
      trip,
      profile: profileSchema.parse(trip.profile),
      items: z.array(itemSchema).parse(trip.items),
      services: servicesSchema.parse(trip.services),
    };
  }
}
