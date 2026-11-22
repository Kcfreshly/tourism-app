import { AppError } from "@/shared/application/app-error";
import type { TripOwner, TripRepository } from "../ports/trip-repository";

// Deletes one of the actor's draft plans. Nothing is booked from a plan, so
// there is nothing to cancel.
export class DeleteTrip {
  constructor(private readonly trips: TripRepository) {}

  async execute(id: string, owner: TripOwner) {
    if (!(await this.trips.deleteOwned(id, owner)))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    return { id };
  }
}
