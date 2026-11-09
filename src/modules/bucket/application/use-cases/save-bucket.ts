import { AppError } from "@/shared/application/app-error";
import type { BucketRepository } from "../ports/bucket-repository";
import type { PublishedOffers } from "../ports/published-offers";

export class SaveBucket {
  constructor(
    private readonly buckets: BucketRepository,
    private readonly published: PublishedOffers,
  ) {}

  // Offers that are no longer published are dropped quietly, so a paused
  // activity never blocks saving; the cleaned list is returned to the client.
  async execute(command: {
    userId: string;
    offerIds: string[];
    expectedVersion: number;
  }) {
    const live = await this.published.ids();
    const saved = await this.buckets.save(
      command.userId,
      command.offerIds.filter((id) => live.has(id)),
      command.expectedVersion,
    );
    if (!saved)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Your bucket changed on another device. Reload it and try again.",
      );
    return saved;
  }
}
