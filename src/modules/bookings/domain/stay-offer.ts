// Stay offers: places to stay that Fastlife staff send into a paid trip. The
// traveller approves one and pays for it as a second payment on the same
// order. The price already includes Fastlife's markup (decided 2026-11-24),
// so no service fee is added.
import { z } from "zod";

export const stayOfferStatuses = [
  "OFFERED",
  "BOOKED",
  "DECLINED",
  "WITHDRAWN",
] as const;
export type StayOfferStatus = (typeof stayOfferStatuses)[number];

// Offers open at once on one order.
export const maxOpenStayOffers = 3;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");

export const sendStayOfferSchema = z
  .object({
    orderReference: z.string().trim().min(3).max(20),
    propertyName: z.string().trim().min(2).max(120),
    area: z.string().trim().min(2).max(60),
    address: z.string().trim().min(5).max(300),
    room: z.string().trim().min(2).max(120),
    checkIn: day,
    checkOut: day,
    note: z.string().trim().max(500).default(""),
    priceMinor: z.number().int().min(100).max(100000000000),
    availableUntil: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((o) => o.checkOut > o.checkIn, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  });
export type SendStayOffer = z.infer<typeof sendStayOfferSchema>;

export const withdrawStayOfferSchema = z
  .object({
    action: z.literal("WITHDRAW"),
    id: z.uuid(),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

// Approving needs only agreement: the contact details come from the trip's
// order. \`contact\` is there so the shared Pay checks accept the body.
export const approveStaySchema = z
  .object({
    agreed: z.literal(true),
    contact: z.object({}).strict().default({}),
  })
  .strict();

// The stay as bought: stored with its checkout line.
export type StayLine = {
  kind: "STAY";
  id: string;
  propertyName: string;
  room: string;
  checkIn: string;
  checkOut: string;
};

export type StayView = {
  id: string;
  version: number;
  propertyName: string;
  area: string;
  address: string;
  room: string;
  checkIn: string;
  checkOut: string;
  note: string;
  priceMinor: number;
  availableUntil: string;
  status: StayOfferStatus;
};

// An offer the traveller can still approve: offered and not yet lapsed.
export function stayOpen(
  offer: Pick<StayView, "status" | "availableUntil">,
  now: Date,
) {
  return offer.status === "OFFERED" && new Date(offer.availableUntil) > now;
}

export function nights(offer: Pick<StayView, "checkIn" | "checkOut">) {
  return Math.round(
    (Date.parse(offer.checkOut) - Date.parse(offer.checkIn)) / 86400000,
  );
}

export function stayStatusLabel(
  offer: Pick<StayView, "status" | "availableUntil">,
  now: Date,
) {
  if (offer.status === "BOOKED") return "Booked";
  if (offer.status === "DECLINED") return "Not chosen";
  if (offer.status === "WITHDRAWN") return "No longer available";
  return stayOpen(offer, now) ? "Ready to approve" : "Offer lapsed";
}
