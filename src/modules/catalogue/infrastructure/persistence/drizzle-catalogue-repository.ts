import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type {
  AuditEntry,
  CatalogueChange,
  CatalogueRepository,
} from "../../application/ports/catalogue-repository";
import type { CatalogueRecord } from "../../domain/experience";
import { catalogue } from "./schema";

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
        details: change.audit.details,
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
        details: entry.details,
      });
      return record;
    });
  }
}
