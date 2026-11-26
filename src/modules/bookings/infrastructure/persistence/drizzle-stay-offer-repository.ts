import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type {
  NewStayOffer,
  StayOfferRepository,
  StayOrder,
  StayTripOrder,
} from "../../application/ports/stay-offer-repository";
import type { StayOfferStatus, StayView } from "../../domain/stay-offer";
import { checkoutLines, checkouts, orders, stayOffers } from "./schema";

const view = (st: typeof stayOffers.$inferSelect): StayView => ({
  id: st.id,
  version: st.version,
  propertyName: st.propertyName,
  area: st.area,
  address: st.address,
  room: st.room,
  checkIn: st.checkIn,
  checkOut: st.checkOut,
  note: st.note,
  priceMinor: st.priceMinor,
  availableUntil: st.availableUntil.toISOString(),
  status: st.status as StayOfferStatus,
});

export class DrizzleStayOfferRepository implements StayOfferRepository {
  constructor(private readonly db: () => Database) {}

  private async orders(where: ReturnType<typeof and>) {
    const rows = await this.db()
      .select({
        orderId: orders.id,
        reference: orders.reference,
        tripId: orders.tripId,
        userId: orders.userId,
        name: checkouts.contactName,
        phone: checkouts.contactPhone,
        email: checkouts.contactEmail,
      })
      .from(orders)
      .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
      .where(where);
    return rows.map((r): StayOrder => ({
      orderId: r.orderId,
      reference: r.reference,
      tripId: r.tripId,
      userId: r.userId,
      contact: { name: r.name, phone: r.phone, email: r.email },
    }));
  }

  async tripOrders() {
    const found = await this.orders(isNotNull(orders.tripId));
    if (!found.length) return [];
    const ids = found.map((o) => o.orderId);
    const span = await this.db()
      .select({
        orderId: orders.id,
        from: sql<string>`min(${checkoutLines.localDate})::text`,
        to: sql<string>`max(${checkoutLines.localDate})::text`,
      })
      .from(orders)
      .innerJoin(checkoutLines, eq(checkoutLines.checkoutId, orders.checkoutId))
      .where(inArray(orders.id, ids))
      .groupBy(orders.id);
    const offers = await this.db()
      .select()
      .from(stayOffers)
      .where(inArray(stayOffers.orderId, ids))
      .orderBy(desc(stayOffers.createdAt));
    return found
      .map((o): StayTripOrder => {
        const s = span.find((x) => x.orderId === o.orderId);
        return {
          orderId: o.orderId,
          reference: o.reference,
          contact: o.contact,
          from: s?.from ?? "",
          to: s?.to ?? "",
          offers: offers.filter((st) => st.orderId === o.orderId).map(view),
        };
      })
      .sort((a, b) => a.from.localeCompare(b.from))
      .slice(0, 50);
  }

  async orderByReference(reference: string) {
    const [found] = await this.orders(eq(orders.reference, reference));
    return found ?? null;
  }

  async find(id: string) {
    const [st] = await this.db()
      .select()
      .from(stayOffers)
      .where(eq(stayOffers.id, id));
    if (!st) return null;
    const [order] = await this.orders(eq(orders.id, st.orderId));
    return order ? { offer: view(st), order } : null;
  }

  async state(orderId: string, now: Date) {
    const rows = await this.db()
      .select({
        open: sql<number>`count(*) filter (where ${stayOffers.status} = 'OFFERED' and ${stayOffers.availableUntil} > ${now.toISOString()}::timestamptz)::int`,
        booked: sql<number>`count(*) filter (where ${stayOffers.status} = 'BOOKED')::int`,
      })
      .from(stayOffers)
      .where(eq(stayOffers.orderId, orderId));
    return {
      open: Number(rows[0]?.open ?? 0),
      booked: Number(rows[0]?.booked ?? 0) > 0,
    };
  }

  async create(offer: NewStayOffer, actorId: string) {
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .insert(stayOffers)
        .values({ ...offer, status: "OFFERED", createdBy: actorId })
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId,
        action: "STAY_OFFERED",
        entityId: row.id,
        details: { orderId: offer.orderId, priceMinor: offer.priceMinor },
      });
      return view(row);
    });
  }

  async withdraw(id: string, expectedVersion: number, actorId: string) {
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .update(stayOffers)
        .set({
          status: "WITHDRAWN",
          version: sql`${stayOffers.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(stayOffers.id, id),
            eq(stayOffers.version, expectedVersion),
            eq(stayOffers.status, "OFFERED"),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId,
        action: "STAY_WITHDRAWN",
        entityId: id,
        details: { orderId: row.orderId },
      });
      return view(row);
    });
  }
}
