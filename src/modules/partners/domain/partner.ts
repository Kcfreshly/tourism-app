// Partner businesses that run activities and ready-made trips, and the
// listings they submit for staff approval. Shared with the browser.
import { z } from "zod";

export const partnerStatuses = [
  "PENDING",
  "VERIFIED",
  "DECLINED",
  "SUSPENDED",
] as const;
export type PartnerStatus = (typeof partnerStatuses)[number];

export const productTypes = ["EXPERIENCE", "PACKAGE"] as const;
export type ProductType = (typeof productTypes)[number];

// DRAFT: the partner is editing. PENDING: waiting for staff. DECLINED: sent
// back with a reason; the partner edits and resubmits. APPROVED: live.
// WITHDRAWN: the partner discarded it.
export const submissionStatuses = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "DECLINED",
  "WITHDRAWN",
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];
export const openSubmissionStatuses: SubmissionStatus[] = [
  "DRAFT",
  "PENDING",
  "DECLINED",
];

export type Partner = {
  id: string;
  businessName: string;
  contactEmail: string;
  phone: string;
  offering: string;
  status: PartnerStatus;
  decisionReason: string | null;
  version: number;
  createdAt: Date;
};

export type Submission = {
  id: string;
  partnerId: string;
  productType: ProductType;
  // The live listing or trip this changes; null until a new one is approved.
  productId: string | null;
  baseVersion: number | null;
  name: string;
  proposed: unknown;
  status: SubmissionStatus;
  reason: string | null;
  version: number;
  submittedAt: Date | null;
  updatedAt: Date;
};

export const partnerApplicationSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    contactEmail: z.email().max(160),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number"),
    offering: z
      .string()
      .trim()
      .min(10, "Tell us in a sentence or two what you run")
      .max(600),
  })
  .strict();
export type PartnerApplication = z.infer<typeof partnerApplicationSchema>;

export const partnerDecisionSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    status: z.enum(["VERIFIED", "DECLINED", "SUSPENDED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (d) => d.status === "VERIFIED" || (d.reason ?? "").length >= 5,
    "Give the partner a reason of at least 5 characters",
  );

export const submissionDecisionSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    decision: z.enum(["APPROVE", "DECLINE"]),
    reason: z.string().trim().max(1000).optional(),
    // Staff confirm the night-time security review for late listings.
    nightVisitAllowed: z.boolean().optional(),
  })
  .strict()
  .refine(
    (d) => d.decision === "APPROVE" || (d.reason ?? "").length >= 5,
    "Tell the partner what to change, in at least 5 characters",
  );

export const partnerStatusLabels: Record<PartnerStatus, string> = {
  PENDING: "Waiting for review",
  VERIFIED: "Verified",
  DECLINED: "Declined",
  SUSPENDED: "Suspended",
};

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  PENDING: "In review",
  APPROVED: "Approved",
  DECLINED: "Changes requested",
  WITHDRAWN: "Withdrawn",
};

export const productTypeLabels: Record<ProductType, string> = {
  EXPERIENCE: "Activity",
  PACKAGE: "Ready-made trip",
};

// Dashboard period: the last `days` Lagos days up to and including today.
export function periodStart(today: string, days: number) {
  return new Date(Date.parse(today + "T12:00:00Z") - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
}

// Change against the previous period, as a whole percentage; null when there
// is nothing to compare with.
export function trend(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
