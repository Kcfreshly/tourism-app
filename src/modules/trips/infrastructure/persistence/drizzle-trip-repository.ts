import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/database/client";
import type {
  TripChanges,
  TripOwner,
  TripRepository,
} from "../../application/ports/trip-repository";
import { proposals, trips } from "./schema";

export function ownedBy(owner: TripOwner) {
  return and(eq(trips.ownerId, owner.id), eq(trips.ownerType, owner.kind));
}

// Optimistic concurrency: only the save that still holds `expectedVersion`
// lands, and it bumps the version.
export function versionedTripUpdate(
  db: Pick<Database, "update">,
  id: string,
  owner: TripOwner,
  expectedVersion: number,
  changes: TripChanges,
) {
  return db
    .update(trips)
    .set({ ...changes, version: expectedVersion + 1, updatedAt: new Date() })
    .where(
      and(eq(trips.id, id), ownedBy(owner), eq(trips.version, expectedVersion)),
    )
    .returning();
}

export class DrizzleTripRepository implements TripRepository {
  constructor(private readonly db: () => Database) {}

  listOwned(owner: TripOwner) {
    return this.db()
      .select()
      .from(trips)
      .where(ownedBy(owner))
      .orderBy(desc(trips.updatedAt));
  }

  async findOwned(id: string, owner: TripOwner) {
    const [trip] = await this.db()
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), ownedBy(owner)));
    return trip ?? null;
  }

  async create(trip: Parameters<TripRepository["create"]>[0]) {
    const [row] = await this.db()
      .insert(trips)
      .values({
        id: trip.id,
        ownerId: trip.owner.id,
        ownerType: trip.owner.kind,
        profile: trip.profile,
        items: [],
        services: trip.services,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    owner: TripOwner,
    expectedVersion: number,
    changes: TripChanges,
  ) {
    const [row] = await versionedTripUpdate(
      this.db(),
      id,
      owner,
      expectedVersion,
      changes,
    );
    return row ?? null;
  }

  deleteOwned(id: string, owner: TripOwner) {
    return this.db().transaction(async (tx) => {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, id), ownedBy(owner)))
        .for("update");
      if (!trip) return false;
      // Proposals reference the trip without cascading.
      await tx.delete(proposals).where(eq(proposals.tripId, id));
      await tx.delete(trips).where(eq(trips.id, id));
      return true;
    });
  }
}
