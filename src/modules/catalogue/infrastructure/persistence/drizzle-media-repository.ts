import { eq } from "drizzle-orm";
import type { Database } from "@/database/client";
import { AppError } from "@/shared/application/app-error";
import type { MediaRepository } from "../../application/ports/media-repository";
import { media } from "./schema";

// Drizzle wraps the driver error, so check the whole cause chain.
function missingTable(error: unknown) {
  for (
    let e = error as { message?: string; code?: string; cause?: unknown };
    e;
    e = e.cause as typeof e
  )
    if (
      e.code === "42P01" ||
      /relation "media" does not exist/.test(String(e.message ?? ""))
    )
      return true;
  return false;
}

export class DrizzleMediaRepository implements MediaRepository {
  constructor(private readonly db: () => Database) {}

  async save(image: Parameters<MediaRepository["save"]>[0]) {
    try {
      const [created] = await this.db()
        .insert(media)
        .values({ ...image, bytes: image.data.byteLength })
        .onConflictDoNothing({ target: media.sha256 })
        .returning();
      if (created) return { id: created.id };
      const [existing] = await this.db()
        .select({ id: media.id })
        .from(media)
        .where(eq(media.sha256, image.sha256));
      return existing;
    } catch (error) {
      if (missingTable(error))
        throw new AppError(
          "CONFLICT",
          "MIGRATION_REQUIRED",
          "Photo uploads need the latest database update. Stop the server, run npm run db:migrate, then start it again.",
        );
      throw error;
    }
  }

  async find(id: string) {
    try {
      const [row] = await this.db()
        .select({
          id: media.id,
          contentType: media.contentType,
          data: media.data,
        })
        .from(media)
        .where(eq(media.id, id));
      return row ?? null;
    } catch (error) {
      if (missingTable(error)) return null;
      throw error;
    }
  }
}
