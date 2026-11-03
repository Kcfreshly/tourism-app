import { z } from "zod";

export const bucketLimit = 30;

export const bucketWriteSchema = z
  .object({
    offerIds: z
      .array(z.string().min(1).max(100))
      .max(bucketLimit)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate offer id"),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export type Bucket = { offerIds: string[]; version: number };

// At sign-in, picks made as a guest are added after the account's saved
// ones, without duplicates, up to the bucket limit.
export function mergeBuckets(saved: string[], guest: string[]) {
  return [...new Set([...saved, ...guest])].slice(0, bucketLimit);
}
