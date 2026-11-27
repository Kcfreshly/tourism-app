import { randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import { lagosToday } from "@/modules/catalogue/domain/events";
import {
  authorName,
  eligibleBooking,
  reviewInputSchema,
  type Review,
} from "../../domain/review";
import type { ReviewRepository } from "../ports/review-repository";
import type { ReviewerBookings } from "../ports/reviewer-bookings";

// Writes or replaces the traveller's one review for a listing. Eligibility is
// decided here from their bookings, never from what the client sends.
export class WriteReview {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly bookings: ReviewerBookings,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(command: {
    user: { id: string; name: string };
    productId: string;
    input: unknown;
    // The version the traveller edited; required when replacing a review.
    expectedVersion?: number;
  }) {
    const input = reviewInputSchema.safeParse(command.input);
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_REVIEW",
        "Give 1 to 5 stars and write at least 20 characters (up to 2,000).",
      );
    const today = lagosToday(this.now());
    const bookings = await this.bookings.forListing(
      command.user.id,
      command.productId,
    );
    const booking = eligibleBooking(bookings, command.productId, today);
    if (!booking)
      throw bookings.some((b) => b.status === "COMPLETED")
        ? new AppError(
            "FORBIDDEN",
            "REVIEW_WINDOW_CLOSED",
            "Reviews can be written up to 90 days after the activity.",
          )
        : new AppError(
            "FORBIDDEN",
            "NOT_ELIGIBLE",
            "You can review this after you’ve done it.",
          );
    const existing = await this.reviews.findByAuthor(
      command.user.id,
      command.productId,
    );
    if (existing && command.expectedVersion !== existing.version)
      throw conflict();
    const at = new Date(this.now());
    const review: Review = {
      id: existing?.id ?? randomUUID(),
      userId: command.user.id,
      productId: command.productId,
      bookingId: booking.id,
      ...input.data,
      authorName: authorName(command.user.name),
      activityDate: booking.localDate,
      // A review staff hid stays hidden when its author edits it.
      status: existing?.status ?? "PUBLISHED",
      hiddenReason: existing?.hiddenReason ?? null,
      version: (existing?.version ?? 0) + 1,
      publishedAt: existing?.publishedAt ?? at,
      updatedAt: at,
    };
    const saved = await this.reviews.save(
      review,
      existing?.version ?? null,
      command.user.id,
    );
    if (!saved) throw conflict();
    return saved;
  }
}

function conflict() {
  return new AppError(
    "CONFLICT",
    "VERSION_CONFLICT",
    "Your review changed somewhere else. Reload and try again.",
  );
}
