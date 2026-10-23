import { z } from "zod";
import { categoryIds } from "./profile";
export const reviewSchema = z
  .object({
    content: z.boolean(),
    rates: z.boolean(),
    capacity: z.boolean(),
    policy: z.boolean(),
    media: z.boolean(),
  })
  .strict();
export const emptyReview = {
  content: false,
  rates: false,
  capacity: false,
  policy: false,
  media: false,
};
export const catalogueEditSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    name: z.string().min(5).max(140),
    categoryId: z.enum(categoryIds),
    zoneId: z.enum(["LEKKI", "VI", "MAINLAND"]),
    kind: z.enum(["MAIN", "LIGHT", "FULL_DAY"]),
    durationMinMinutes: z.number().int().min(30).max(420),
    durationMaxMinutes: z.number().int().min(30).max(480),
    rateMinor: z.number().int().min(0).max(100000000),
    capacityPerSlot: z.number().int().min(1).max(100),
    status: z.enum([
      "DRAFT",
      "RESEARCHED",
      "DEMO_VERIFIED",
      "DEMO_PUBLISHED",
      "PAUSED",
    ]),
    review: reviewSchema,
  })
  .strict()
  .refine(
    (v) => v.durationMaxMinutes >= v.durationMinMinutes,
    "Maximum duration must be at least minimum duration",
  );
export function demoPublishIssues(review: z.infer<typeof reviewSchema>) {
  return Object.entries(review)
    .filter(([, value]) => !value)
    .map(([name]) => `${name} review required`);
}
