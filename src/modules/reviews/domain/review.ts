// Verified activity reviews (docs/REVIEWS_PLAN.md). Only a traveller whose
// booking for the listing is COMPLETED may review it, once per listing, within
// a window after the activity. A summary per listing keeps the average without
// reading every review.
import { z } from "zod";

export const reviewWindowDays = 90;
// Below this many published reviews, listings show "New" instead of stars.
export const minReviewsForAverage = 3;

export type BookingStatus =
  | "AWAITING_PARTNER"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

// A traveller's booking for one listing, as the bookings module reports it.
export type ReviewableBooking = {
  id: string;
  productId: string;
  localDate: string;
  status: BookingStatus;
};

export type ReviewStatus = "PUBLISHED" | "HIDDEN";

export type Review = {
  id: string;
  userId: string;
  productId: string;
  bookingId: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  activityDate: string;
  status: ReviewStatus;
  hiddenReason: string | null;
  version: number;
  publishedAt: Date;
  updatedAt: Date;
};

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((t) => t || null),
  body: z.string().trim().min(20).max(2000),
});
export type ReviewInput = z.output<typeof reviewInputSchema>;

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
      86400000,
  );
}

// The completed booking that lets this traveller review now: the most recent
// one still inside the window. Null when none qualifies.
export function eligibleBooking(
  bookings: ReviewableBooking[],
  productId: string,
  today: string,
) {
  return (
    bookings
      .filter(
        (b) =>
          b.productId === productId &&
          b.status === "COMPLETED" &&
          b.localDate <= today &&
          daysBetween(b.localDate, today) <= reviewWindowDays,
      )
      .sort((a, b) => b.localDate.localeCompare(a.localDate))[0] ?? null
  );
}

export type ReviewState = "CAN_REVIEW" | "REVIEWED" | "CLOSED" | "NOT_YET";

// What "My bookings" offers for one booking. A review already written for the
// listing counts, whichever booking it came from.
export function reviewState(
  booking: ReviewableBooking,
  hasReview: boolean,
  today: string,
): ReviewState {
  if (hasReview) return "REVIEWED";
  if (booking.status !== "COMPLETED") return "NOT_YET";
  return eligibleBooking([booking], booking.productId, today)
    ? "CAN_REVIEW"
    : "CLOSED";
}

// "Ada Okafor" -> "Ada O."; a single name stays as it is.
export function authorName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Traveller";
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export type ReviewSummary = {
  count: number;
  sum: number;
  // Published reviews with 1..5 stars, in that order.
  histogram: [number, number, number, number, number];
};

export const emptySummary = (): ReviewSummary => ({
  count: 0,
  sum: 0,
  histogram: [0, 0, 0, 0, 0],
});

type Counted = { rating: number; status: ReviewStatus } | null;

// Adjusts a summary for one review going from `before` to `after` (null for
// created or deleted). Only published reviews count.
export function applyToSummary(
  summary: ReviewSummary,
  before: Counted,
  after: Counted,
): ReviewSummary {
  const next: ReviewSummary = {
    count: summary.count,
    sum: summary.sum,
    histogram: [...summary.histogram],
  };
  for (const [review, sign] of [
    [before, -1],
    [after, 1],
  ] as const) {
    if (review?.status !== "PUBLISHED") continue;
    next.count += sign;
    next.sum += sign * review.rating;
    next.histogram[review.rating - 1] += sign;
  }
  return next;
}

// Stars to show for a listing, or null while it has too few reviews.
export function ratingDisplay(summary: ReviewSummary) {
  if (summary.count < minReviewsForAverage) return null;
  return {
    average: Math.round((summary.sum / summary.count) * 10) / 10,
    count: summary.count,
  };
}

export const reviewSorts = ["recent", "highest", "lowest"] as const;
export type ReviewSort = (typeof reviewSorts)[number];

// Keyset position after the last review on a page. Opaque to clients.
export type ReviewCursor = { publishedAt: string; rating: number; id: string };

export function encodeCursor(review: Review): string {
  const cursor: ReviewCursor = {
    publishedAt: review.publishedAt.toISOString(),
    rating: review.rating,
    id: review.id,
  };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

const cursorSchema = z.object({
  publishedAt: z.iso.datetime(),
  rating: z.number().int().min(1).max(5),
  id: z.string().min(1).max(64),
});

export function decodeCursor(value: string): ReviewCursor | null {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
