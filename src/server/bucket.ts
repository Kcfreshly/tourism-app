import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { accountBuckets } from "./schema";
import { listCatalogue } from "./catalogue";
import { ApiError } from "./identity";
import type { Bucket } from "../domain/bucket";

export async function loadBucket(userId: string): Promise<Bucket> {
  const [row] = await db()
    .select({
      offerIds: accountBuckets.offerIds,
      version: accountBuckets.version,
    })
    .from(accountBuckets)
    .where(eq(accountBuckets.userId, userId));
  return row ?? { offerIds: [], version: 0 };
}

// Replaces the saved bucket when `expectedVersion` still matches. Offers that
// are no longer published are dropped quietly, so a paused activity never
// blocks saving; the cleaned list is returned to the client.
export async function saveBucket(
  userId: string,
  offerIds: string[],
  expectedVersion: number,
): Promise<Bucket> {
  const published = new Set((await listCatalogue()).map((e) => e.offer.id));
  const cleaned = offerIds.filter((id) => published.has(id));
  const [row] = await db()
    .insert(accountBuckets)
    .values({ userId, offerIds: cleaned, version: 1 })
    .onConflictDoUpdate({
      target: accountBuckets.userId,
      set: {
        offerIds: cleaned,
        version: sql`${accountBuckets.version} + 1`,
        updatedAt: sql`now()`,
      },
      setWhere: eq(accountBuckets.version, expectedVersion),
    })
    .returning();
  if (!row)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "Your bucket changed on another device. Reload it and try again.",
    );
  return { offerIds: row.offerIds, version: row.version };
}
