import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import { user } from "@/modules/identity/infrastructure/persistence/schema";
import type {
  AuditEntry,
  CatalogueChange,
  CatalogueRepository,
  DeletedListing,
} from "../../application/ports/catalogue-repository";
import type { CatalogueRecord } from "../../domain/experience";
import { catalogue } from "./schema";

// What every catalogue audit event stores: the whole row after the change.
function snapshotOf(row: CatalogueRecord) {
  return {
    id: row.id,
    seedKey: row.seedKey,
    status: row.status,
    version: row.version,
    record: row.record,
    review: row.review,
    partnerId: row.partnerId ?? null,
  };
}

export class DrizzleCatalogueRepository implements CatalogueRepository {
  constructor(private readonly db: () => Database) {}

  listPublished() {
    return this.db()
      .select()
      .from(catalogue)
      .where(eq(catalogue.status, "DEMO_PUBLISHED"));
  }

  listAll() {
    return this.db().select().from(catalogue);
  }

  update(
    input: { id: string; expectedVersion: number; actorId: string },
    decide: (current: CatalogueRecord | undefined) => CatalogueChange,
  ) {
    return this.db().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(catalogue)
        .where(eq(catalogue.id, input.id));
      const change = decide(existing);
      const [changed] = await tx
        .update(catalogue)
        .set({
          status: change.status,
          record: change.record,
          review: change.review,
          version: input.expectedVersion + 1,
        })
        .where(
          and(
            eq(catalogue.id, input.id),
            eq(catalogue.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!changed) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: change.audit.action,
        entityId: input.id,
        details: { ...change.audit.details, snapshot: snapshotOf(changed) },
      });
      return changed;
    });
  }

  createDraft(row: Omit<CatalogueRecord, "version">, entry: AuditEntry) {
    return this.db().transaction(async (tx) => {
      const [record] = await tx.insert(catalogue).values(row).returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: entry.actorId,
        action: entry.action,
        entityId: row.id,
        details: { ...entry.details, snapshot: snapshotOf(record) },
      });
      return record;
    });
  }

  delete(input: {
    id: string;
    expectedVersion: number;
    actorId: string;
    reason: string | null;
  }) {
    return this.db().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(catalogue)
        .where(eq(catalogue.id, input.id));
      if (!existing) return undefined;
      const [removed] = await tx
        .delete(catalogue)
        .where(
          and(
            eq(catalogue.id, input.id),
            eq(catalogue.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!removed) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: "CATALOGUE_DELETED",
        entityId: input.id,
        details: { reason: input.reason, snapshot: snapshotOf(removed) },
      });
      return removed;
    });
  }

  async history(entityId: string) {
    const rows = await this.db()
      .select({
        id: audit.id,
        action: audit.action,
        actorId: audit.actorId,
        actorName: user.name,
        actorEmail: user.email,
        createdAt: audit.createdAt,
        details: audit.details,
      })
      .from(audit)
      .leftJoin(user, eq(user.id, audit.actorId))
      .where(eq(audit.entityId, entityId))
      .orderBy(desc(audit.createdAt));
    return rows.map(({ actorEmail, ...r }) => ({
      ...r,
      actorName: r.actorName ?? actorEmail,
      details: r.details as Record<string, unknown>,
    }));
  }

  async deleted() {
    const db = this.db();
    const events = await db
      .select({
        id: audit.id,
        entityId: audit.entityId,
        actorId: audit.actorId,
        actorName: user.name,
        actorEmail: user.email,
        createdAt: audit.createdAt,
        details: audit.details,
      })
      .from(audit)
      .leftJoin(user, eq(user.id, audit.actorId))
      .where(eq(audit.action, "CATALOGUE_DELETED"))
      .orderBy(desc(audit.createdAt));
    if (!events.length) return [];
    const listed = new Set(
      (
        await db
          .select({ id: catalogue.id })
          .from(catalogue)
          .where(
            inArray(
              catalogue.id,
              events.map((e) => e.entityId),
            ),
          )
      ).map((r) => r.id),
    );
    const seen = new Set<string>();
    const result: DeletedListing[] = [];
    for (const e of events) {
      // Only the latest deletion of a listing that is still gone.
      if (listed.has(e.entityId) || seen.has(e.entityId)) continue;
      seen.add(e.entityId);
      const details = e.details as {
        reason?: string | null;
        snapshot: CatalogueRecord;
      };
      result.push({
        auditId: e.id,
        deletedAt: e.createdAt,
        deletedBy: e.actorName ?? e.actorEmail ?? e.actorId,
        reason: details.reason ?? null,
        snapshot: details.snapshot,
      });
    }
    return result;
  }

  restore(input: { auditId: string; actorId: string }) {
    return this.db().transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(audit)
        .where(eq(audit.id, input.auditId));
      const snapshot = (event?.details as { snapshot?: CatalogueRecord })
        ?.snapshot;
      if (!event || event.action !== "CATALOGUE_DELETED" || !snapshot)
        return { kind: "NOT_A_DELETION" as const };
      const [byId] = await tx
        .select({ id: catalogue.id })
        .from(catalogue)
        .where(eq(catalogue.id, snapshot.id));
      if (byId) return { kind: "ALREADY_LISTED" as const };
      const [bySeed] = await tx
        .select({ id: catalogue.id })
        .from(catalogue)
        .where(eq(catalogue.seedKey, snapshot.seedKey));
      if (bySeed) return { kind: "SEED_KEY_TAKEN" as const };
      const [row] = await tx
        .insert(catalogue)
        .values({
          id: snapshot.id,
          seedKey: snapshot.seedKey,
          status: snapshot.status,
          version: snapshot.version + 1,
          record: snapshot.record,
          review: snapshot.review,
          partnerId: snapshot.partnerId ?? null,
        })
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: "CATALOGUE_RESTORED",
        entityId: row.id,
        details: { restoredFrom: event.id, snapshot: snapshotOf(row) },
      });
      return { kind: "RESTORED" as const, row };
    });
  }
}
