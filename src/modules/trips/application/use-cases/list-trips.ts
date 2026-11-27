import type { TripOwner, TripRepository } from "../ports/trip-repository";
import { noTripBookings, type TripBookings } from "../ports/trip-bookings";

// The actor's trips, most recently updated first, each with the order that
// paid for it, if any.
export class ListTrips {
  constructor(
    private readonly trips: TripRepository,
    private readonly bookings: TripBookings = noTripBookings,
  ) {}

  async execute(owner: TripOwner) {
    const trips = await this.trips.listOwned(owner);
    const orders = await this.bookings.ordersFor(trips.map((t) => t.id));
    return trips.map((t) => ({
      ...t,
      orderReference: orders.get(t.id) ?? null,
    }));
  }
}
