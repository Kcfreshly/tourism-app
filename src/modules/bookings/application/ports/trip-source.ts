import type { TripForCheckout } from "../../domain/trip-checkout";

// What trip checkout needs from the trips module: the traveller's own trip
// with a freshly calculated planner price, whether it has blockers, whether
// it is already paid for, and whether its pickup address or flight details
// are overdue.
export interface TripSource {
  load(
    userId: string,
    tripId: string,
  ): Promise<
    TripForCheckout & {
      id: string;
      version: number;
      blockers: { message: string }[];
      orderReference: string | null;
      // A car is booked and the pickup address is due already.
      pickupOverdue: boolean;
      // An airport pickup is booked and its flight details are due already.
      flightOverdue?: boolean;
    }
  >;
}
