import { z } from "zod";
import { addDays } from "../../catalogue/domain/schedule";
import {
  formatMoney,
  zoneLabel,
} from "../../catalogue/domain/experience-content";
// Where the traveller stays, for headers and summaries.
export function stayLabel(
  p: Pick<Profile, "accommodation" | "accommodationBy" | "zoneId" | "stay">,
) {
  const area = p.zoneId !== "UNDECIDED" ? zoneLabel(p.zoneId) : "";
  if (p.accommodationBy === "FASTLIFE")
    return [
      "Stay booked by Fastlife",
      area,
      p.stay && stayTypes[p.stay.type],
      p.stay?.budgetPerNightMinor !== undefined &&
        `up to ${formatMoney(p.stay.budgetPerNightMinor)} a night`,
      p.stay &&
        p.stay.choice.kind !== "RECOMMEND" &&
        stayChoiceLabel(p.stay.choice),
    ]
      .filter(Boolean)
      .join(" · ");
  return p.accommodation.trim() || area || "Base not set";
}
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
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times");

// Airports we pick up from. Lagos only for now.
export const airports = {
  LOS: "Lagos, Murtala Muhammed (LOS)",
} as const;
export type AirportId = keyof typeof airports;

// An airline code and number, like BA75 or P47571. Spaces are dropped.
const flightNumber = z
  .string()
  .trim()
  .max(12)
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^(?:[A-Z0-9]{2}\d{1,4}[A-Z]?)?$/,
        "Use a flight number like BA75",
      ),
  );

// A driver meets travellers arriving from abroad. Flight details can come
// later, until a reminder before landing; the date fixes the price line.
export const airportPickupSchema = z
  .object({
    airport: z.enum(Object.keys(airports) as [AirportId]),
    flight: flightNumber,
    landingDate: date,
    // Empty until they know it.
    landingTime: z.union([z.literal(""), clock]),
    travellers: z.number().int().min(1).max(8),
    bags: z.number().int().min(0).max(30),
  })
  .strict();
export type AirportPickup = z.infer<typeof airportPickupSchema>;

export const stayTypes = {
  HOTEL: "Hotel",
  APARTMENT: "Serviced apartment or short-let",
  GUESTHOUSE: "Guesthouse",
  RESORT: "Resort",
} as const;
export type StayType = keyof typeof stayTypes;

export const linkSources = {
  BOOKING: "Booking.com listing",
  AIRBNB: "Airbnb listing",
  WEBSITE: "Hotel website",
} as const;
export type LinkSource = keyof typeof linkSources;

// A pasted link: https only, up to 500 characters. Booking.com and Airbnb
// are recognised by host; anything else is a hotel website. Null when it
// isn't a usable link. Never fetched by the server.
export function readStayLink(
  text: string,
): { url: string; source: LinkSource } | null {
  const value = text.trim();
  if (value.length > 500 || !/^https:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const source: LinkSource =
    host === "booking.com" || host.endsWith(".booking.com")
      ? "BOOKING"
      : /(^|\.)airbnb\.[a-z.]+$/.test(host)
        ? "AIRBNB"
        : "WEBSITE";
  return { url: url.toString(), source };
}

// What the traveller asked for when Fastlife books the stay. The area is
// the trip's zone (`zoneId`), so it lives in one place.
export const stayChoiceSchema = z.discriminatedUnion("kind", [
  // From our hotel list; the name is kept for display.
  z
    .object({
      kind: z.literal("LISTED"),
      hotelId: z.uuid(),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  // Typed by the traveller and not in our list: unverified for staff.
  z
    .object({
      kind: z.literal("NAMED"),
      name: z.string().trim().min(2).max(120),
    })
    .strict(),
  z
    .object({
      kind: z.literal("LINK"),
      url: z.string().max(500),
      source: z.enum(Object.keys(linkSources) as [LinkSource]),
    })
    .strict()
    .refine((c) => readStayLink(c.url)?.source === c.source, {
      message: "Paste a link that starts with https://",
      path: ["url"],
    }),
  // No preference: we send recommendations within 48 hours.
  z.object({ kind: z.literal("RECOMMEND") }).strict(),
]);
export type StayChoice = z.infer<typeof stayChoiceSchema>;

export const stayRequestSchema = z
  .object({
    type: z.enum(Object.keys(stayTypes) as [StayType]),
    budgetPerNightMinor: z.number().int().min(0).max(10000000000).optional(),
    choice: stayChoiceSchema,
  })
  .strict();
export type StayRequest = z.infer<typeof stayRequestSchema>;

// We reply to "recommend me a stay" within this long of payment.
export const stayRecommendHours = 48;

export function stayChoiceLabel(choice: StayChoice) {
  if (choice.kind === "LISTED") return choice.name;
  if (choice.kind === "NAMED") return `${choice.name} (their own choice)`;
  if (choice.kind === "LINK") return linkSources[choice.source];
  return "No preference: send recommendations";
}

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
    // A pickup address when they book their own stay, or stay
    // preferences when Fastlife books it.
    accommodation: z.string().max(300),
    // Who books the stay: the traveller (default) or Fastlife.
    accommodationBy: z.enum(["SELF", "FASTLIFE"]).optional(),
    zoneId: z.enum(["UNDECIDED", "LEKKI", "VI", "MAINLAND"]),
    // What to look for when Fastlife books the stay.
    stay: stayRequestSchema.optional(),
    // Arriving from outside Nigeria, and the airport pickup if they want one.
    fromAbroad: z.boolean().optional(),
    airportPickup: airportPickupSchema.optional(),
    assistance: z.enum(["DRIVER_ONLY", "ACTIVITY_GUIDE", "FULL_DAY_GUIDE"]),
    budgetMinor: z.number().int().min(0).max(10000000000),
    budgetBasis: z.enum(["PARTY", "PERSON"]),
    dietary: z.string().max(300),
    accessibility: z.string().max(300).optional(),
    // A car for the day or their own way; each day can differ in the
    // planner. Trips saved while rides existed load as car trips.
    transport: z
      .preprocess(
        (v) => (v === "RIDES" ? "DEDICATED" : v),
        z.enum(["DEDICATED", "OWN"]),
      )
      .optional(),
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
    const pickup = p.airportPickup;
    if (
      pickup &&
      (pickup.landingDate < p.startDate || pickup.landingDate > p.endDate)
    )
      c.addIssue({
        code: "custom",
        path: ["airportPickup", "landingDate"],
        message: "Choose a landing date within your trip dates",
      });
    if (pickup && pickup.travellers > p.adults)
      c.addIssue({
        code: "custom",
        path: ["airportPickup", "travellers"],
        message: "More travellers on the flight than on the trip",
      });
  });
export type Profile = z.infer<typeof profileSchema>;
// A new trip starts two weeks out and runs a week, so the form never opens on
// dates that have already passed.
export function upcomingTrip(today: string) {
  const startDate = addDays(today, 14);
  return { startDate, endDate: addDays(startDate, 6) };
}
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
