import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type { HotelRepository } from "../../application/ports/hotel-repository";
import type { Hotel, HotelInput } from "../../domain/hotels";
import { hotels } from "./schema";

const view = (h: typeof hotels.$inferSelect): Hotel => ({
  id: h.id,
  version: h.version,
  name: h.name,
  aliases: h.aliases,
  zoneId: h.zoneId as Hotel["zoneId"],
  type: h.type as Hotel["type"],
  address: h.address,
  active: h.active,
});

export class DrizzleHotelRepository implements HotelRepository {
  constructor(private readonly db: () => Database) {}

  async list() {
    const rows = await this.db()
      .select()
      .from(hotels)
      .orderBy(asc(hotels.name));
    return rows.map(view);
  }

  create(hotel: HotelInput & { id: string }, actorId: string) {
    return this.db().transaction(async (tx) => {
      const [row] = await tx.insert(hotels).values(hotel).returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId,
        action: "HOTEL_CREATED",
        entityId: row.id,
        details: { name: row.name, zoneId: row.zoneId, type: row.type },
      });
      return view(row);
    });
  }

  update(
    id: string,
    expectedVersion: number,
    hotel: HotelInput,
    actorId: string,
  ) {
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .update(hotels)
        .set({
          ...hotel,
          version: sql`${hotels.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(hotels.id, id), eq(hotels.version, expectedVersion)))
        .returning();
      if (!row) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId,
        action: "HOTEL_UPDATED",
        entityId: id,
        details: { previousVersion: expectedVersion, hotel },
      });
      return view(row);
    });
  }
}
