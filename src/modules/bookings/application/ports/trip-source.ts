import type { TripForCheckout } from "../../domain/trip-checkout";

// What trip checkout needs from the trips module: the traveller's own trip
// with a freshly calculated planner price, and whether it has blockers.
export interface TripSource {
  load(
    userId: string,
    tripId: string,
  ): Promise<
    TripForCheckout & {
      id: string;
      version: number;
      blockers: { message: string }[];
    }
  >;
}
