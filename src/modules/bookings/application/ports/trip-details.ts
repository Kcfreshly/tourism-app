import type { Profile } from "../../../trips/domain/profile";

// What staff need from a paid trip's profile, read live so details added
// after payment (flight number, landing time) show up: the airport pickup
// and what to look for when Fastlife books the stay.
export type TripArrangements = Pick<
  Profile,
  | "startDate"
  | "endDate"
  | "adults"
  | "zoneId"
  | "accommodationBy"
  | "stay"
  | "airportPickup"
>;

export interface TripDetails {
  arrangements(tripIds: string[]): Promise<Map<string, TripArrangements>>;
}

export const noTripDetails: TripDetails = {
  arrangements: async () => new Map(),
};
