import type {
  Review,
  ReviewCursor,
  ReviewSort,
  ReviewStatus,
  ReviewSummary,
} from "../../domain/review";

// Every write also adjusts the listing's summary (applyToSummary) and records
// an audit event for `actorId`, in the same transaction as the review row.
export interface ReviewRepository {
  findByAuthor(userId: string, productId: string): Promise<Review | null>;
  findById(id: string): Promise<Review | null>;
  // Inserts when `expectedVersion` is null, otherwise replaces the review
  // while its version still matches. Null when another write won.
  save(
    review: Review,
    expectedVersion: number | null,
    actorId: string,
  ): Promise<Review | null>;
  remove(review: Review, actorId: string): Promise<void>;
  setStatus(
    id: string,
    status: ReviewStatus,
    reason: string | null,
    expectedVersion: number,
    actorId: string,
  ): Promise<Review | null>;
  // Published reviews for a listing after `cursor`, in `sort` order, ties
  // broken by id.
  listPublished(
    productId: string,
    sort: ReviewSort,
    cursor: ReviewCursor | null,
    limit: number,
  ): Promise<Review[]>;
  listForStaff(
    filter: { status?: ReviewStatus; productId?: string; rating?: number },
    offset: number,
    limit: number,
  ): Promise<{ items: Review[]; total: number }>;
  summary(productId: string): Promise<ReviewSummary>;
}
