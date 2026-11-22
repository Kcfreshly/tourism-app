import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { AppError } from "@/shared/application/app-error";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type { AuditEntry } from "../../application/ports/catalogue-repository";
import type {
  PackageChange,
  PackageRepository,
} from "../../application/ports/package-repository";
import {
  demoPackages,
  type PackageRecord,
  type TripPackage,
} from "../../domain/packages";
import { packages } from "./schema";

// Until migration 0007 runs the table is missing; travellers still see the
// demo trips, and staff edits report the missing migration.
// Drizzle wraps the driver error, so check the whole cause chain for
// Postgres's "undefined table" code or message.
function missingTable(error: unknown) {
  for (
    let e = error as { message?: string; code?: string; cause?: unknown };
    e;
    e = e.cause as typeof e
  )
    if (
      e.code === "42P01" ||
      /relation "packages" does not exist/.test(String(e.message ?? ""))
    )
      return true;
  return false;
}

// Staff writes need the table; say which command creates it.
async function needsTable<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    if (missingTable(error))
      throw new AppError(
        "CONFLICT",
        "MIGRATION_REQUIRED",
        "Ready-made trips need the latest database update. Stop the server, run npm run db:migrate and npm run db:seed:demo, then start it again.",
      );
    throw error;
  }
}

const fallback = (): PackageRecord[] =>
  demoPackages.map((record, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    slug: record.slug,
    status: "DEMO_PUBLISHED",
    version: 1,
    record,
  }));

function toRecord(row: typeof packages.$inferSelect): PackageRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    version: row.version,
    record: row.record as TripPackage,
  };
}

export class DrizzlePackageRepository implements PackageRepository {
  constructor(private readonly db: () => Database) {}

  private async read(published: boolean) {
    try {
      const rows = await this.db()
        .select()
        .from(packages)
        .where(published ? eq(packages.status, "DEMO_PUBLISHED") : undefined);
      return rows.map(toRecord);
    } catch (error) {
      if (missingTable(error)) return fallback();
      throw error;
    }
  }

  listPublished() {
    return this.read(true);
  }

  listAll() {
    return this.read(false);
  }

  slugTaken(slug: string) {
    return needsTable(async () => {
      const [row] = await this.db()
        .select({ id: packages.id })
        .from(packages)
        .where(eq(packages.slug, slug));
      return !!row;
    });
  }

  create(row: Omit<PackageRecord, "version">, entry: AuditEntry) {
    return needsTable(() =>
      this.db().transaction(async (tx) => {
        const [created] = await tx.insert(packages).values(row).returning();
        await tx.insert(audit).values({
          id: randomUUID(),
          actorId: entry.actorId,
          action: entry.action,
          entityId: row.id,
          details: entry.details,
        });
        return toRecord(created);
      }),
    );
  }

  update(
    input: { id: string; expectedVersion: number; actorId: string },
    decide: (current: PackageRecord | undefined) => PackageChange,
  ) {
    return needsTable(() =>
      this.db().transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(packages)
          .where(eq(packages.id, input.id));
        const change = decide(existing && toRecord(existing));
        const [changed] = await tx
          .update(packages)
          .set({
            status: change.status,
            record: change.record,
            version: input.expectedVersion + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(packages.id, input.id),
              eq(packages.version, input.expectedVersion),
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
        return toRecord(changed);
      }),
    );
  }
}
