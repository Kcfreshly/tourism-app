import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type { TransportSettingsRepository } from "../../application/ports/transport-settings-repository";
import {
  defaultTransportSettings,
  readTransportSettings,
} from "../../domain/transport-settings";
import { transportSettings } from "./schema";

const rowId = "default";

// Until migration 0006 runs the table is missing; pricing keeps working on
// the defaults and saving reports the missing migration.
function missingTable(error: unknown) {
  const text = String((error as { message?: string })?.message ?? error);
  return /transport_settings/.test(text) && /does not exist/.test(text);
}

export class DrizzleTransportSettingsRepository implements TransportSettingsRepository {
  constructor(private readonly db: () => Database) {}

  async get() {
    try {
      const [row] = await this.db()
        .select()
        .from(transportSettings)
        .where(eq(transportSettings.id, rowId));
      return row
        ? {
            settings: readTransportSettings(row.settings),
            version: row.version,
          }
        : { settings: defaultTransportSettings, version: 0 };
    } catch (error) {
      if (missingTable(error))
        return { settings: defaultTransportSettings, version: 0 };
      throw error;
    }
  }

  save(input: Parameters<TransportSettingsRepository["save"]>[0]) {
    return this.db().transaction(async (tx) => {
      const version = input.expectedVersion + 1;
      const [row] =
        input.expectedVersion === 0
          ? await tx
              .insert(transportSettings)
              .values({ id: rowId, settings: input.settings, version })
              .onConflictDoNothing()
              .returning()
          : await tx
              .update(transportSettings)
              .set({
                settings: input.settings,
                version,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(transportSettings.id, rowId),
                  eq(transportSettings.version, input.expectedVersion),
                ),
              )
              .returning();
      if (!row) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: "TRANSPORT_SETTINGS_UPDATED",
        entityId: rowId,
        details: {
          previousVersion: input.expectedVersion,
          changed: input.changed,
        },
      });
      return { settings: input.settings, version: row.version };
    });
  }
}
