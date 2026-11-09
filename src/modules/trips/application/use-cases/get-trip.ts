import { AppError } from "@/shared/application/app-error";
import type { TripOwner, TripRepository } from "../ports/trip-repository";

export class GetTrip {
  constructor(private readonly trips: TripRepository) {}

  async execute(id: string, owner: TripOwner) {
    const trip = await this.trips.findOwned(id, owner);
    if (!trip) throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    return trip;
  }
}
