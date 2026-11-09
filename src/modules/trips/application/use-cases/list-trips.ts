import type { TripOwner, TripRepository } from "../ports/trip-repository";

// The actor's trips, most recently updated first.
export class ListTrips {
  constructor(private readonly trips: TripRepository) {}

  execute(owner: TripOwner) {
    return this.trips.listOwned(owner);
  }
}
