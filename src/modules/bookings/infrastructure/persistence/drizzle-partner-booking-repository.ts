import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import { partners } from "@/modules/partners/infrastructure/persistence/schema";
import type {
  BookingChange,
  PartnerBookingRepository,
} from "../../application/ports/partner-booking-repository";
import type { CartLine } from "../../domain/cart";
import type { BookingStatus } from "../../domain/checkout";
import {
  lateDeclineReason,
  partnerShare,
  type PartnerBookingView,
} from "../../domain/partner-booking";
import {
  bookingStatusHistory,
  bookings,
  checkoutLines,
  checkouts,
  orders,
} from "./schema";

const waitingFirst = (a: PartnerBookingView, b: PartnerBookingView) => {
  const rank = (v: PartnerBookingView) =>
    v.status === "AWAITING_PARTNER" ? 0 : 1;
  return (
    rank(a) - rank(b) ||
    (rank(a) === 0
      ? (a.partnerDeadline ?? "").localeCompare(b.partnerDeadline ?? "")
      : 0) ||
    a.date.localeCompare(b.date) ||
    a.startTime.localeCompare(b.startTime)
  );
};

export class DrizzlePartnerBookingRepository implements PartnerBookingRepository {
  constructor(private readonly db: () => Database) {}

  private async read(where: ReturnType<typeof and>, limit = 200) {
    const rows = await this.db()
      .select({
        booking: bookings,
        reference: orders.reference,
        businessName: partners.businessName,
        title: checkoutLines.title,
        line: checkoutLines.cartLine,
        subtotalMinor: checkoutLines.subtotalMinor,
        name: checkouts.contactName,
        phone: checkouts.contactPhone,
        email: checkouts.contactEmail,
      })
      .from(bookings)
      .innerJoin(orders, eq(orders.id, bookings.orderId))
      .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
      .innerJoin(checkoutLines, eq(checkoutLines.id, bookings.checkoutLineId))
      .leftJoin(partners, eq(partners.id, bookings.partnerId))
      .where(where)
      .orderBy(desc(bookings.createdAt))
      .limit(limit);
    if (!rows.length) return [];
    // The latest decline reason for each declined booking.
    const declined = rows
      .filter((r) => r.booking.status === "DECLINED")
      .map((r) => r.booking.id);
    const reasons = new Map<string, string>();
    if (declined.length)
      for (const h of await this.db()
        .select({
          bookingId: bookingStatusHistory.bookingId,
          reason: bookingStatusHistory.reason,
        })
        .from(bookingStatusHistory)
        .where(
          and(
            inArray(bookingStatusHistory.bookingId, declined),
            eq(bookingStatusHistory.toStatus, "DECLINED"),
          ),
        )
        .orderBy(desc(bookingStatusHistory.createdAt)))
        if (h.reason && !reasons.has(h.bookingId))
          reasons.set(h.bookingId, h.reason);
    return rows
      .map((r): PartnerBookingView => ({
        id: r.booking.id,
        version: r.booking.version,
        orderReference: r.reference,
        partnerId: r.booking.partnerId,
        businessName: r.businessName,
        productType: r.booking.productType as PartnerBookingView["productType"],
        title: r.title,
        date: r.booking.localDate,
        startTime: r.booking.startTime === "DAY" ? "" : r.booking.startTime,
        line: r.line as CartLine,
        status: r.booking.status as BookingStatus,
        partnerDeadline: r.booking.partnerDeadline?.toISOString() ?? null,
        totalMinor: r.booking.totalMinor,
        partnerShareMinor: partnerShare(
          r.subtotalMinor,
          r.booking.commissionBps,
        ),
        commissionBps: r.booking.commissionBps,
        guest: { name: r.name, phone: r.phone, email: r.email },
        reason: reasons.get(r.booking.id) ?? null,
        createdAt: r.booking.createdAt.toISOString(),
      }))
      .sort(waitingFirst);
  }

  listForPartner(partnerId: string) {
    // Waiting ones, and anything from the last 30 days on.
    const since = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    return this.read(
      and(
        eq(bookings.partnerId, partnerId),
        or(
          eq(bookings.status, "AWAITING_PARTNER"),
          gte(bookings.localDate, since),
        ),
      ),
    );
  }

  listForStaff() {
    return this.read(
      and(
        sql`${bookings.partnerId} IS NOT NULL`,
        inArray(bookings.status, ["AWAITING_PARTNER", "DECLINED"]),
      ),
    );
  }

  async find(id: string) {
    const [found] = await this.read(eq(bookings.id, id), 1);
    return found ?? null;
  }

  async decide(change: BookingChange) {
    const changed = await this.db().transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, change.id))
        .for("update");
      if (!before || before.version !== change.expectedVersion) return false;
      await tx
        .update(bookings)
        .set({
          status: change.status,
          version: sql`${bookings.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, change.id));
      await tx.insert(bookingStatusHistory).values({
        id: randomUUID(),
        bookingId: change.id,
        fromStatus: before.status,
        toStatus: change.status,
        actorType: change.actorType,
        actorId: change.actorId,
        reason: change.reason,
      });
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: change.actorId,
        action: `BOOKING_${change.status}`,
        entityId: change.id,
        details: {
          from: before.status,
          by: change.actorType,
          partnerId: before.partnerId,
          reason: change.reason,
        },
      });
      return true;
    });
    return changed ? this.find(change.id) : null;
  }

  async expireOverdue(now: Date) {
    const expired = await this.db().transaction(async (tx) => {
      const rows = await tx
        .update(bookings)
        .set({
          status: "DECLINED",
          version: sql`${bookings.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.status, "AWAITING_PARTNER"),
            lte(bookings.partnerDeadline, now),
          ),
        )
        .returning();
      if (!rows.length) return [];
      await tx.insert(bookingStatusHistory).values(
        rows.map((r) => ({
          id: randomUUID(),
          bookingId: r.id,
          fromStatus: "AWAITING_PARTNER",
          toStatus: "DECLINED",
          actorType: "SYSTEM",
          actorId: "partner-deadline",
          reason: lateDeclineReason,
        })),
      );
      await tx.insert(audit).values(
        rows.map((r) => ({
          id: randomUUID(),
          actorId: "SYSTEM",
          action: "BOOKING_DECLINED",
          entityId: r.id,
          details: {
            from: "AWAITING_PARTNER",
            reason: "PARTNER_DEADLINE",
            partnerId: r.partnerId,
          },
        })),
      );
      return rows.map((r) => r.id);
    });
    return expired.length ? this.read(inArray(bookings.id, expired)) : [];
  }
}
