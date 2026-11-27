// A partner confirms or declines each paid booking that waits for them.
// Paying books a place; confirming makes it final. A decline, or no answer by
// the deadline, means a full refund is due and the places go back on sale.
import { z } from "zod";
import type { CartLine } from "./cart";
import type { BookingStatus } from "./checkout";

const target = {
  id: z.uuid(),
  expectedVersion: z.number().int().min(1),
};

export const bookingDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM"), ...target }).strict(),
  z
    .object({
      action: z.literal("DECLINE"),
      ...target,
      // Shown to the traveller with their refund notice.
      reason: z
        .string()
        .trim()
        .min(5, "Tell the traveller why, in at least 5 characters")
        .max(300),
    })
    .strict(),
]);
export type BookingDecision = z.infer<typeof bookingDecisionSchema>;

// Only a booking still waiting can be confirmed or declined.
export function nextBookingStatus(
  current: BookingStatus,
  action: BookingDecision["action"],
): BookingStatus | null {
  if (current !== "AWAITING_PARTNER") return null;
  return action === "CONFIRM" ? "CONFIRMED" : "DECLINED";
}

export const lateDeclineReason =
  "Not confirmed by the partner in time; refund due.";

// A booking as the partner (and staff) see it.
export type PartnerBookingView = {
  id: string;
  version: number;
  orderReference: string;
  partnerId: string | null;
  businessName: string | null;
  productType: "EXPERIENCE" | "PACKAGE";
  title: string;
  date: string;
  startTime: string;
  line: CartLine;
  status: BookingStatus;
  partnerDeadline: string | null;
  // What the traveller paid, and the partner's share after commission.
  totalMinor: number;
  partnerShareMinor: number;
  commissionBps: number | null;
  guest: { name: string; phone: string; email: string };
  // The latest decline reason, when declined.
  reason: string | null;
  createdAt: string;
};

// The partner's share: the price before Fastlife's service fee, less
// commission.
export function partnerShare(
  subtotalMinor: number,
  commissionBps: number | null,
) {
  return (
    subtotalMinor - Math.round((subtotalMinor * (commissionBps ?? 0)) / 10000)
  );
}
