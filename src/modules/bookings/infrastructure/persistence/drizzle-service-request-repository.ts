import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type {
  QueuedService,
  ServiceChange,
  ServiceRequestRepository,
} from "../../application/ports/service-request-repository";
import type {
  ServiceKind,
  ServiceLine,
  ServiceStatus,
} from "../../domain/trip-checkout";
import {
  checkoutLines,
  checkouts,
  orders,
  serviceRequestHistory,
  serviceRequests,
} from "./schema";

// What the queue shows: requests still needing staff, and refunds due.
const queueStatuses: ServiceStatus[] = ["REQUESTED", "MATCHED", "UNMATCHED"];

export class DrizzleServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly db: () => Database) {}

  private async read(where: ReturnType<typeof and>) {
    const rows = await this.db()
      .select({
        request: serviceRequests,
        reference: orders.reference,
        name: checkouts.contactName,
        phone: checkouts.contactPhone,
        line: checkoutLines.cartLine,
      })
      .from(serviceRequests)
      .innerJoin(orders, eq(orders.id, serviceRequests.orderId))
      .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
      .innerJoin(
        checkoutLines,
        eq(checkoutLines.id, serviceRequests.checkoutLineId),
      )
      .where(where)
      .orderBy(asc(serviceRequests.localDate), asc(serviceRequests.startTime));
    return rows.map(
      ({ request: r, reference, name, phone, line }): QueuedService => ({
        id: r.id,
        version: r.version,
        userId: r.userId,
        orderReference: reference,
        service: r.service as ServiceKind,
        date: r.localDate,
        startTime: r.startTime,
        label: (line as ServiceLine).label,
        status: r.status as ServiceStatus,
        matchBy: r.matchBy.toISOString(),
        assignee: r.assignee,
        contact: { name, phone },
        totalMinor: r.totalMinor,
      }),
    );
  }

  listQueue() {
    return this.read(inArray(serviceRequests.status, queueStatuses));
  }

  async find(id: string) {
    const [found] = await this.read(eq(serviceRequests.id, id));
    return found ?? null;
  }

  async update(change: ServiceChange) {
    const changed = await this.db().transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, change.id))
        .for("update");
      if (!before || before.version !== change.expectedVersion) return null;
      await tx
        .update(serviceRequests)
        .set({
          status: change.status,
          ...(change.assignee ? { assignee: change.assignee } : {}),
          version: sql`${serviceRequests.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, change.id));
      await tx.insert(serviceRequestHistory).values({
        id: randomUUID(),
        serviceRequestId: change.id,
        fromStatus: before.status,
        toStatus: change.status,
        actorType: change.actorType,
        actorId: change.actorId,
        note: change.note,
      });
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: change.actorId,
        action: `SERVICE_${change.status}`,
        entityId: change.id,
        details: {
          from: before.status,
          assignee: change.assignee ?? before.assignee,
          note: change.note,
        },
      });
      return true;
    });
    return changed ? this.find(change.id) : null;
  }

  async expireOverdue(now: Date) {
    const expired = await this.db().transaction(async (tx) => {
      const rows = await tx
        .update(serviceRequests)
        .set({
          status: "UNMATCHED",
          version: sql`${serviceRequests.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceRequests.status, "REQUESTED"),
            lte(serviceRequests.matchBy, now),
          ),
        )
        .returning();
      if (!rows.length) return [];
      await tx.insert(serviceRequestHistory).values(
        rows.map((r) => ({
          id: randomUUID(),
          serviceRequestId: r.id,
          fromStatus: "REQUESTED",
          toStatus: "UNMATCHED",
          actorType: "SYSTEM",
          actorId: "matching-deadline",
          note: "Nobody matched by the deadline; refund due.",
        })),
      );
      await tx.insert(audit).values(
        rows.map((r) => ({
          id: randomUUID(),
          actorId: "SYSTEM",
          action: "SERVICE_UNMATCHED",
          entityId: r.id,
          details: { from: "REQUESTED", reason: "MATCH_DEADLINE" },
        })),
      );
      return rows.map((r) => r.id);
    });
    return expired.length
      ? this.read(inArray(serviceRequests.id, expired))
      : [];
  }
}
