import type { Bucket } from "../../domain/bucket";

export interface BucketRepository {
  load(userId: string): Promise<Bucket>;
  // Replaces the saved list while `expectedVersion` still matches; null when
  // another device saved first.
  save(
    userId: string,
    offerIds: string[],
    expectedVersion: number,
  ): Promise<Bucket | null>;
}
