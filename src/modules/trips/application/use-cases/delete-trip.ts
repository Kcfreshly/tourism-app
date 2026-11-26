import { AppError } from "@/shared/application/app-error";
import type { TripOwner, TripRepository } from "../ports/trip-repository";
import { noTripBookings, type TripBookings } from "../ports/trip-bookings";
import { tripBooked } from "../services/booked-trip";

// Deletes one of the actor's draft plans. A booked trip stays: its
// bookings and driver/guide requests were made from it.
export class DeleteTrip {
  constructor(
    private readonly trips: TripRepository,
    private readonly bookings: TripBookings = noTripBookings,
  ) {}

  async execute(id: string, owner: TripOwner) {
    const orderReference = await this.bookings.orderFor(id);
    if (orderReference) throw tripBooked(orderReference);
    if (!(await this.trips.deleteOwned(id, owner)))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
    return { id };
  }
}
