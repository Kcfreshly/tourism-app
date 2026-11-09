import type { BucketRepository } from "../ports/bucket-repository";

export class GetBucket {
  constructor(private readonly buckets: BucketRepository) {}

  execute(userId: string) {
    return this.buckets.load(userId);
  }
}
