import { inArray } from "drizzle-orm";
import type { Database } from "@/database/client";
import { profileSchema, type Profile } from "../../domain/profile";
import { trips } from "./schema";

// The parts of paid trips' profiles that staff queues and the traveller's
// fulfilment tracker show, by trip id. Trips whose profile no longer parses
// are left out.
export type Arrangements = Pick<
  Profile,
  | "startDate"
  | "endDate"
  | "adults"
  | "zoneId"
  | "accommodationBy"
  | "stay"
  | "airportPickup"
>;

export class DrizzleTripArrangements {
  constructor(private readonly db: () => Database) {}

  async arrangements(tripIds: string[]) {
    const found = new Map<string, Arrangements>();
    const ids = [...new Set(tripIds)];
    if (!ids.length) return found;
    const rows = await this.db()
      .select({ id: trips.id, profile: trips.profile })
      .from(trips)
      .where(inArray(trips.id, ids));
    for (const row of rows) {
      const parsed = profileSchema.safeParse(row.profile);
      if (!parsed.success) continue;
      const p = parsed.data;
      found.set(row.id, {
        startDate: p.startDate,
        endDate: p.endDate,
        adults: p.adults,
        zoneId: p.zoneId,
        accommodationBy: p.accommodationBy,
        stay: p.stay,
        airportPickup: p.airportPickup,
      });
    }
    return found;
  }
}
