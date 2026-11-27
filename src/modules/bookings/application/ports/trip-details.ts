import type { TripArrangements } from "../../domain/checkout";

export type { TripArrangements };

// Paid trips' profiles by trip id, for the matching and stay queues and the
// traveller's fulfilment tracker.
export interface TripDetails {
  arrangements(tripIds: string[]): Promise<Map<string, TripArrangements>>;
}

export const noTripDetails: TripDetails = {
  arrangements: async () => new Map(),
};
