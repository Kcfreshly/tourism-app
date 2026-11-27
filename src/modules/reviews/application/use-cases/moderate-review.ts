import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import type { ReviewRepository } from "../ports/review-repository";

const moderationSchema = z
  .object({
    status: z.enum(["PUBLISHED", "HIDDEN"]),
    reason: z.string().trim().max(300).optional(),
    expectedVersion: z.number().int().min(1),
  })
  .refine((m) => m.status !== "HIDDEN" || !!m.reason, {
    message: "A reason is required to hide a review.",
  });

const staffQuerySchema = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  experienceId: z.string().max(64).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// Staff hide a review (with a reason) or publish it again. Hidden reviews
// leave the listing's average.
export class ModerateReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(actorId: string, id: string, input: unknown) {
    const parsed = moderationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_MODERATION",
        "Choose PUBLISHED or HIDDEN, and give a reason when hiding.",
      );
    if (!(await this.reviews.findById(id)))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Review not found.");
    const { status, reason, expectedVersion } = parsed.data;
    const saved = await this.reviews.setStatus(
      id,
      status,
      status === "HIDDEN" ? reason! : null,
      expectedVersion,
      actorId,
    );
    if (!saved)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This review changed since you opened it. Reload and try again.",
      );
    return saved;
  }
}

// The staff review table: small, so offset-paged.
export class ListReviewsForStaff {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(query: Record<string, string | undefined>) {
    const parsed = staffQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_QUERY",
        "Use status, experienceId, rating 1–5, offset and a limit up to 100.",
      );
    const { status, experienceId, rating, offset, limit } = parsed.data;
    return this.reviews.listForStaff(
      { status, productId: experienceId, rating },
      offset,
      limit,
    );
  }
}
