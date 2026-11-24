// Checkout: a priced cart with places held while the traveller pays, then an
// order with one booking per line. See docs/PAYMENT_INTEGRATION_PLAN.md.
import { z } from "zod";
import rules from "../../../../tourism-v1-handoff/data/pricing.demo.json";
import {
  cartLimit,
  cartLineSchema,
  type CartLine,
  type PriceRow,
} from "./cart";
import type { LineTerms } from "./resolve-line";
import type { ServiceKind, ServiceStatus } from "./trip-checkout";

export const holdMinutes = rules.holdMinutes;
export const priceVersion = rules.version;

export const checkoutStatuses = [
  "HELD",
  "PAYMENT_PENDING",
  "PAID",
  "EXPIRED",
  "FAILED",
  "REQUIRES_REVIEW",
] as const;
export type CheckoutStatus = (typeof checkoutStatuses)[number];

export const bookingStatuses = [
  "AWAITING_PARTNER",
  "CONFIRMED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

// Bookings that still take their places.
export const holdingBookingStatuses: BookingStatus[] = [
  "AWAITING_PARTNER",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
];

// Sample platform commission until partners agree rates (D10). Copied onto
// each partner booking at payment.
export const defaultCommissionBps = 1500;

export const startCheckoutSchema = z
  .object({
    lines: z
      .array(cartLineSchema)
      .min(1)
      .max(cartLimit)
      .refine(
        (lines) => new Set(lines.map((l) => l.id)).size === lines.length,
        "Duplicate cart line id",
      ),
    // The total the traveller saw; a different server total refuses (PRICE_CHANGED).
    shownTotalMinor: z.number().int().min(1),
    contact: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9][0-9 ()-]{6,19}$/),
      })
      .strict(),
    agreed: z.literal(true),
  })
  .strict();
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;

export const startTripCheckoutSchema = z
  .object({
    // The trip version and total the traveller reviewed.
    expectedVersion: z.number().int().min(1),
    shownTotalMinor: z.number().int().min(1),
    contact: startCheckoutSchema.shape.contact,
    agreed: z.literal(true),
  })
  .strict();
export type StartTripCheckoutInput = z.infer<typeof startTripCheckoutSchema>;

// Traveller-facing order reference, e.g. FL-7K3Q9P. No 0/O or 1/I.
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function orderReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `FL-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

// Our reference for one payment attempt, sent to the provider.
export function paymentReference() {
  return `fl_${crypto.randomUUID().replaceAll("-", "")}`;
}

// Instant listings are confirmed by payment; partner-confirmed ones wait
// for the operator until the deadline (D4).
export function initialBookingStatus(terms: LineTerms, paidAt: Date) {
  return terms.confirmation === "INSTANT"
    ? { status: "CONFIRMED" as const, partnerDeadline: null }
    : {
        status: "AWAITING_PARTNER" as const,
        partnerDeadline: new Date(
          paidAt.getTime() + terms.partnerHours * 3600000,
        ),
      };
}

export const bookingStatusLabels: Record<BookingStatus, string> = {
  AWAITING_PARTNER: "Waiting for the operator",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined, refund due",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "Missed",
};

// A paid order as the traveller sees it.
export type BookingView = {
  id: string;
  cartLineId: string;
  title: string;
  productType: "EXPERIENCE" | "PACKAGE";
  date: string;
  startTime: string;
  status: BookingStatus;
  partnerDeadline: string | null;
  totalMinor: number;
  feeMinor: number;
  rows: PriceRow[];
  terms: LineTerms;
  line: CartLine;
};

// A paid car, night car or guide and who was matched to it.
export type ServiceView = {
  id: string;
  service: ServiceKind;
  date: string;
  startTime: string;
  label: string;
  status: ServiceStatus;
  matchBy: string;
  assignee: Record<string, string> | null;
  totalMinor: number;
  feeMinor: number;
  rows: PriceRow[];
};

export type OrderView = {
  reference: string;
  // Set when the order paid for a planned trip.
  tripId: string | null;
  createdAt: string;
  totalMinor: number;
  contact: { name: string; email: string; phone: string };
  bookings: BookingView[];
  services: ServiceView[];
};
