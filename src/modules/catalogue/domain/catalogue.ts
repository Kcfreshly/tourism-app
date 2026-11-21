import { z } from "zod";
import { categoryIds } from "../../trips/domain/profile";
import { eventTypes } from "./events";
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
export const zoneIds = ["LEKKI", "VI", "MAINLAND"] as const;
export const listingKinds = ["MAIN", "LIGHT", "FULL_DAY"] as const;
export const listingStatuses = [
  "DRAFT",
  "RESEARCHED",
  "DEMO_VERIFIED",
  "DEMO_PUBLISHED",
  "PAUSED",
] as const;
export const intensities = ["LOW", "MODERATE", "HIGH"] as const;
export const wheelchairAccesses = [
  "UNKNOWN",
  "NONE",
  "PARTIAL",
  "FULL",
] as const;
export const arrivalModes = [
  "SELF",
  "PICKUP_OPTIONAL",
  "PICKUP_REQUIRED",
] as const;
export const confirmationModes = ["INSTANT", "PARTNER"] as const;

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times");
const lateClock = z
  .string()
  .regex(/^(?:([01]\d|2\d):[0-5]\d|30:00)$/, "Use HH:MM, up to 30:00");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");
const minor = z.number().int().min(0).max(100000000);
const lines = z.array(z.string().trim().min(1).max(160)).max(20);

export const sessionSchema = z
  .object({
    startTime: clock,
    durationMinutes: z.number().int().min(15).max(720),
    dates: z.array(day).max(60).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
  })
  .strict();

// Everything staff can change on a listing. Fields after `review` are
// optional so older clients that send only the core fields keep working; an
// omitted field keeps its stored value.
export const catalogueEditSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    name: z.string().min(5).max(140),
    categoryId: z.enum(categoryIds),
    zoneId: z.enum(zoneIds),
    kind: z.enum(listingKinds),
    durationMinMinutes: z.number().int().min(30).max(420),
    durationMaxMinutes: z.number().int().min(30).max(480),
    rateMinor: minor,
    capacityPerSlot: z.number().int().min(1).max(100),
    // Minimum notice the operator needs before a session starts; 0 means it
    // can be booked right up to the start time.
    bookingCutoffHours: z.number().int().min(0).max(168).optional(),
    // The framework's night-time security review passed: required before a
    // listing that runs past midnight can be verified or published.
    nightVisitAllowed: z.boolean().optional(),
    status: z.enum(listingStatuses),
    review: reviewSchema,
    // Customer-facing copy shown on cards, the overlay and the detail page.
    story: z
      .object({
        teaser: z.string().trim().min(10).max(140),
        summary: z.string().trim().min(20).max(600),
        why: z.string().trim().max(300),
      })
      .strict()
      .optional(),
    tags: z.array(z.string().trim().min(2).max(30)).max(10).optional(),
    // Pricing and party rules.
    priceBasis: z.enum(["PER_ADULT", "PER_GROUP"]).optional(),
    capacityUnit: z.enum(["PERSON", "GROUP"]).optional(),
    minParty: z.number().int().min(1).max(50).optional(),
    maxParty: z.number().int().min(1).max(50).optional(),
    minAge: z.number().int().min(0).max(21).optional(),
    hostIncluded: z.boolean().optional(),
    // Operator, venue, arrival and booking terms (see listing-details.ts).
    details: z
      .object({
        operator: z.string().trim().min(2).max(120),
        venue: z.string().trim().min(2).max(160),
        arrival: z.enum(arrivalModes),
        pickupRateMinor: minor,
        childRateMinor: minor,
        confirmation: z.enum(confirmationModes),
        partnerHours: z.number().int().min(0).max(168),
        freeCancellationHours: z.number().int().min(0).max(720),
      })
      .strict()
      .optional(),
    // When it runs.
    availability: z
      .object({
        days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
        opensAt: clock,
        // Past 24:00 means the early hours of the next day, e.g. 28:00.
        closesAt: lateClock,
      })
      .strict()
      .optional(),
    schedulingType: z.enum(["FLEXIBLE", "FIXED"]).optional(),
    sessions: z.array(sessionSchema).max(12).optional(),
    unavailableDates: z.array(day).max(120).optional(),
    // Access and what the price covers.
    mobility: z
      .object({
        intensity: z.enum(intensities),
        wheelchairAccess: z.enum(wheelchairAccesses),
      })
      .strict()
      .optional(),
    inclusions: lines.optional(),
    exclusions: lines.optional(),
    // Media. An empty photo id falls back to the category photo.
    photoId: z.string().max(80).optional(),
    videoUrl: z
      .union([z.literal(""), z.string().regex(/^(\/|https:\/\/)\S+$/)])
      .optional(),
    // Dated events; null turns a listing back into an everyday activity.
    event: z
      .object({
        type: z.enum(eventTypes),
        guaranteed: z.string().trim().max(300).optional(),
        bonus: z.string().trim().max(300).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (v) => v.durationMaxMinutes >= v.durationMinMinutes,
    "Maximum duration must be at least minimum duration",
  )
  .refine(
    (v) => !v.minParty || !v.maxParty || v.maxParty >= v.minParty,
    "Maximum party must be at least minimum party",
  )
  .refine(
    (v) => !v.availability || v.availability.closesAt > v.availability.opensAt,
    "Closing time must be after opening time",
  )
  .refine(
    (v) => v.schedulingType !== "FIXED" || !!v.sessions?.length,
    "Fixed listings need at least one session",
  )
  .refine(
    (v) => !v.event || !!v.sessions?.some((s) => s.dates?.length),
    "Events need at least one dated session",
  );

export function demoPublishIssues(review: z.infer<typeof reviewSchema>) {
  return Object.entries(review)
    .filter(([, value]) => !value)
    .map(([name]) => `${name} review required`);
}
export type CatalogueReview = z.infer<typeof reviewSchema>;
export type CatalogueEdit = z.infer<typeof catalogueEditSchema>;
const reviewedStatuses = ["DEMO_VERIFIED", "DEMO_PUBLISHED"];
// Runs into the early hours: closes after midnight, or a session ends after it.
export function runsPastMidnight(e: {
  availabilityLocal: { closesAt: string };
  sessions?: { startTime: string; durationMinutes: number }[];
}) {
  const at = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return (
    at(e.availabilityLocal.closesAt) > 1440 ||
    (e.sessions ?? []).some((s) => at(s.startTime) + s.durationMinutes > 1440)
  );
}
// The onboarding framework's night-time security review must be recorded
// before a late-night listing is verified or published.
export function nightReviewIssue(
  record: Parameters<typeof runsPastMidnight>[0] & {
    nightVisitAllowed?: boolean;
  },
  status: string,
) {
  return reviewedStatuses.includes(status) &&
    runsPastMidnight(record) &&
    !record.nightVisitAllowed
    ? {
        code: "NIGHT_REVIEW_REQUIRED",
        message:
          "This listing runs past midnight. Tick “Night visit allowed” once the night-time security review has passed.",
      }
    : null;
}
// Review rules for a staff edit. Returns the first reason the edit is refused.
export function catalogueEditIssue(
  current: { status: string; isDemo: boolean },
  edit: CatalogueEdit,
): { code: string; message: string } | null {
  if (current.isDemo !== true)
    return {
      code: "LIVE_EDIT_DISABLED",
      message: "This workspace only edits fictional demo supply.",
    };
  if (reviewedStatuses.includes(edit.status)) {
    const issues = demoPublishIssues(edit.review);
    if (issues.length)
      return { code: "REVIEW_REQUIRED", message: issues.join("; ") };
    if (
      !reviewedStatuses.includes(current.status) &&
      edit.status === "DEMO_PUBLISHED"
    )
      return {
        code: "VERIFY_FIRST",
        message: "Save as demo verified before publishing.",
      };
  }
  return null;
}
