import { eq, sql } from "drizzle-orm";
import type { Database } from "@/database/client";
import type { BucketRepository } from "../../application/ports/bucket-repository";
import { accountBuckets } from "./schema";

export class DrizzleBucketRepository implements BucketRepository {
  constructor(private readonly db: () => Database) {}

  async load(userId: string) {
    const [row] = await this.db()
      .select({
        offerIds: accountBuckets.offerIds,
        version: accountBuckets.version,
      })
      .from(accountBuckets)
      .where(eq(accountBuckets.userId, userId));
    return row ?? { offerIds: [], version: 0 };
  }

  async save(userId: string, offerIds: string[], expectedVersion: number) {
    const [row] = await this.db()
      .insert(accountBuckets)
      .values({ userId, offerIds, version: 1 })
      .onConflictDoUpdate({
        target: accountBuckets.userId,
        set: {
          offerIds,
          version: sql`${accountBuckets.version} + 1`,
          updatedAt: sql`now()`,
        },
        setWhere: eq(accountBuckets.version, expectedVersion),
      })
      .returning();
    return row ? { offerIds: row.offerIds, version: row.version } : null;
  }
}
