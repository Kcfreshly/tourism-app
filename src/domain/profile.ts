import { z } from "zod";
export const categoryIds = [
  "nature",
  "waterfront",
  "local-life",
  "food",
  "culture",
  "nightlife",
  "recreation",
  "shopping",
] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid calendar date",
  );
export const profileSchema = z
  .object({
    cityId: z.literal("lagos"),
    draftName: z.string().trim().max(80).optional(),
    startDate: date,
    endDate: date,
    adults: z.number().int().min(1).max(8),
    interests: z.array(z.enum(categoryIds)).min(1).max(8),
    occasion: z.string().max(160),
    pace: z.enum(["RELAXED", "BALANCED", "FULL"]),
    accommodation: z.string().max(300),
    zoneId: z.enum(["UNDECIDED", "LEKKI", "VI", "MAINLAND"]),
    assistance: z.enum(["DRIVER_ONLY", "ACTIVITY_GUIDE", "FULL_DAY_GUIDE"]),
    budgetMinor: z.number().int().min(0).max(10000000000),
    budgetBasis: z.enum(["PARTY", "PERSON"]),
    dietary: z.string().max(300),
    accessibility: z.string().max(300).optional(),
    transport: z.enum(["DEDICATED", "OWN"]).optional(),
    alcohol: z.enum(["OPTIONAL", "NO_ALCOHOL"]),
    walking: z.enum(["LOW", "MODERATE"]),
    selectedOfferIds: z.array(z.string().max(100)).max(30),
  })
  .strict()
  .superRefine((p, c) => {
    const days =
      (Date.parse(p.endDate) - Date.parse(p.startDate)) / 86400000 + 1;
    if (days < 1 || days > 30)
      c.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Choose 1–30 local calendar days",
      });
  });
export type Profile = z.infer<typeof profileSchema>;
export const initialProfile: Profile = {
  cityId: "lagos",
  startDate: "2026-11-10",
  endDate: "2026-11-16",
  adults: 2,
  interests: ["nature", "culture", "local-life"],
  occasion: "",
  pace: "BALANCED",
  accommodation: "",
  zoneId: "UNDECIDED",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
};
