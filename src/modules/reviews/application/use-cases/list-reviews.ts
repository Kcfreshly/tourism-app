import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import {
  decodeCursor,
  encodeCursor,
  ratingDisplay,
  reviewSorts,
  type Review,
} from "../../domain/review";
import type { ReviewRepository } from "../ports/review-repository";

const querySchema = z.object({
  sort: z.enum(reviewSorts).default("recent"),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// What the public sees of a review: no account or booking ids.
export function publicReview(review: Review) {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    author: review.authorName,
    activityMonth: review.activityDate.slice(0, 7),
    publishedAt: review.publishedAt.toISOString(),
    edited: review.updatedAt.getTime() !== review.publishedAt.getTime(),
  };
}

// One page of a listing's published reviews, keyset-paged.
export class ListReviews {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(productId: string, query: Record<string, string | undefined>) {
    const parsed = querySchema.safeParse(query);
    const cursor = parsed.data?.cursor
      ? decodeCursor(parsed.data.cursor)
      : null;
    if (!parsed.success || (parsed.data.cursor && !cursor))
      throw new AppError(
        "INVALID",
        "INVALID_QUERY",
        "Use sort=recent|highest|lowest, a limit from 1 to 50 and a cursor from the previous page.",
      );
    const { sort, limit } = parsed.data;
    // One extra row tells us whether another page exists.
    const rows = await this.reviews.listPublished(
      productId,
      sort,
      cursor,
      limit + 1,
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map(publicReview),
      nextCursor:
        rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
    };
  }
}

// Stars and the 1–5 breakdown for a listing page.
export class GetRatingSummary {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(productId: string) {
    const summary = await this.reviews.summary(productId);
    return {
      rating: ratingDisplay(summary),
      count: summary.count,
      histogram: summary.histogram,
    };
  }
}
