import { AppError } from "@/shared/application/app-error";
import type { ReviewRepository } from "../ports/review-repository";

// Removes the traveller's own review of a listing.
export class DeleteReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(userId: string, productId: string) {
    const review = await this.reviews.findByAuthor(userId, productId);
    if (!review)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Review not found.");
    await this.reviews.remove(review, userId);
    return { id: review.id };
  }
}
