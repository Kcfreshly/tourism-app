import { inArray } from "drizzle-orm";
import type { Database } from "@/database/client";
import { profileSchema } from "../../domain/profile";
import { trips } from "./schema";

// Paid trips' profiles for staff queues, by trip id. Trips whose profile no
// longer parses are left out.
export class DrizzleTripArrangements {
  constructor(private readonly db: () => Database) {}

  async arrangements(tripIds: string[]) {
    const found = new Map<string, ReturnType<typeof profileSchema.parse>>();
    const ids = [...new Set(tripIds)];
    if (!ids.length) return found;
    const rows = await this.db()
      .select({ id: trips.id, profile: trips.profile })
      .from(trips)
      .where(inArray(trips.id, ids));
    for (const row of rows) {
      const parsed = profileSchema.safeParse(row.profile);
      if (parsed.success) found.set(row.id, parsed.data);
    }
    return found;
  }
}
