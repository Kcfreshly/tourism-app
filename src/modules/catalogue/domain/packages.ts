// Ready-made multi-day trips run by partner operators, such as three days in
// Obudu. Staff create and publish them in the admin panel; the demo fixtures
// seed the table and stand in until migration 0007 has run. The schema lets
// an unfinished draft be saved; packageReadiness gates publishing.
import { z } from "zod";
import fixture from "../../../data/packages.demo.json";
import { tagIds } from "./tags";

export const inclusionItems = [
  "ACCOMMODATION",
  "FLIGHTS",
  "GROUND_TRANSPORT",
  "GUIDE",
  "MEALS",
  "ENTRY_FEES",
] as const;
export const inclusionStatuses = [
  "INCLUDED",
  "PARTIAL",
  "ON_REQUEST",
  "NOT_INCLUDED",
] as const;
export type InclusionStatus = (typeof inclusionStatuses)[number];
export const seatStates = ["OPEN", "LIMITED", "FULL"] as const;
export const packagePriceBases = ["PER_PERSON_TWIN", "PER_PERSON"] as const;
export const packageStatuses = ["DRAFT", "DEMO_PUBLISHED", "PAUSED"] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");
const minor = z.number().int().min(0).max(1000000000);
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const packageSchema = z
  .object({
    slug: z.string().min(3).max(60).regex(slugPattern),
    isDemo: z.literal(true),
    title: z.string().trim().min(5).max(120),
    summary: z.string().trim().max(400),
    operator: z.string().trim().max(120),
    operatorNote: z.string().trim().max(300),
    startCity: z.string().trim().min(2).max(60),
    nights: z.number().int().min(0).max(30),
    route: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(31),
            place: z.string().trim().max(120),
            plan: z.string().trim().max(400),
          })
          .strict(),
      )
      .min(1)
      .max(31),
    departures: z
      .array(z.object({ date: day, seats: z.enum(seatStates) }).strict())
      .max(30),
    priceMinor: minor,
    priceBasis: z.enum(packagePriceBases),
    singleSupplementMinor: minor,
    inclusions: z
      .array(
        z
          .object({
            item: z.enum(inclusionItems),
            status: z.enum(inclusionStatuses),
            detail: z.string().trim().max(200),
          })
          .strict(),
      )
      .max(inclusionItems.length),
    bookingTerms: z.array(z.string().trim().min(1).max(300)).max(10),
    tags: z.array(z.enum(tagIds)).max(10).optional(),
  })
  .strict()
  .refine(
    (p) => p.route.every((r, i) => r.day === i + 1),
    "Route days must run 1, 2, 3… in order",
  )
  .refine(
    (p) => p.nights <= p.route.length,
    "A trip can't have more nights than days",
  )
  .refine(
    (p) =>
      new Set(p.departures.map((d) => d.date)).size === p.departures.length,
    "Each departure date can only be listed once",
  )
  .refine(
    (p) =>
      new Set(p.inclusions.map((i) => i.item)).size === p.inclusions.length,
    "Each inclusion can only be listed once",
  );

export type TripPackage = z.infer<typeof packageSchema>;

// One stored row: the trip plus its publication state.
export type PackageRecord = {
  id: string;
  slug: string;
  status: string;
  version: number;
  record: TripPackage;
  // The partner who runs it; null or absent for Fastlife's own trips.
  partnerId?: string | null;
};

export const packageEditSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    status: z.enum(packageStatuses),
    trip: packageSchema,
  })
  .strict();
export type PackageEdit = z.infer<typeof packageEditSchema>;

export const demoPackages: TripPackage[] = fixture.packages.map((p) =>
  packageSchema.parse(p),
);

// A URL-safe slug from a title: "3 days in Obudu!" → "3-days-in-obudu".
export function slugify(title: string) {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/, "") || "trip"
  );
}

// A new trip with every inclusion listed as not included, so staff only
// change what the operator offers.
export function draftPackage(slug: string, title: string): TripPackage {
  return {
    slug,
    isDemo: true,
    title,
    summary: "",
    operator: "",
    operatorNote: "",
    startCity: "Lagos",
    nights: 2,
    route: [1, 2, 3].map((d) => ({ day: d, place: "", plan: "" })),
    departures: [],
    priceMinor: 0,
    priceBasis: "PER_PERSON_TWIN",
    singleSupplementMinor: 0,
    inclusions: inclusionItems.map((item) => ({
      item,
      status: "NOT_INCLUDED",
      detail: "",
    })),
    bookingTerms: [],
    tags: [],
  };
}

// What a trip still needs before travellers can see it.
export function packageReadiness(p: TripPackage, today: string) {
  const missing: string[] = [];
  if (p.summary.trim().length < 20) missing.push("Write a summary");
  if (!p.operator.trim()) missing.push("Name the operator");
  if (p.route.length < 2) missing.push("Add at least two days to the route");
  if (p.route.some((r) => !r.place.trim() || !r.plan.trim()))
    missing.push("Give every day a place and a plan");
  if (p.priceMinor <= 0) missing.push("Set a price above ₦0");
  if (!p.departures.some((d) => d.date >= today && d.seats !== "FULL"))
    missing.push("Add an upcoming departure with seats");
  if (p.inclusions.length < inclusionItems.length)
    missing.push("Say whether each inclusion is covered");
  if (!p.bookingTerms.length) missing.push("Add the booking terms");
  return missing;
}

export const inclusionLabels: Record<string, string> = {
  ACCOMMODATION: "Accommodation",
  FLIGHTS: "Flights",
  GROUND_TRANSPORT: "Ground transport",
  GUIDE: "Guide",
  MEALS: "Meals",
  ENTRY_FEES: "Entry fees",
};

export const inclusionStatusLabels: Record<InclusionStatus, string> = {
  INCLUDED: "Included",
  PARTIAL: "Partly included",
  ON_REQUEST: "Arranged by operator on request",
  NOT_INCLUDED: "Not included",
};

export const seatLabels: Record<string, string> = {
  OPEN: "Seats open",
  LIMITED: "Few seats left",
  FULL: "Full",
};

export function packageRoute(p: Pick<TripPackage, "route">) {
  const places = p.route.flatMap((r) => r.place.split(" → "));
  return places.filter((place, i) => place !== places[i - 1]).join(" → ");
}

export function packageLength(p: Pick<TripPackage, "nights" | "route">) {
  return `${p.route.length} days · ${p.nights} ${p.nights === 1 ? "night" : "nights"}`;
}

export function priceBasisText(basis: string) {
  return basis === "PER_PERSON_TWIN" ? "per person, sharing" : "per person";
}

// What Fastlife does for every ready-made trip, on top of the operator's own
// terms. Sample commitments pending agreement.
export const fastlifeSupport = [
  {
    title: "Pre-arrival check",
    text: "A week before departure we confirm documents, meeting point and contacts with you.",
  },
  {
    title: "Help with changes",
    text: "We handle date or traveller changes with the operator, within their terms.",
  },
  {
    title: "Early exit help",
    text: "If you need to leave early, we help arrange your return. Refunds follow the operator's terms.",
  },
];

// Seeds a custom plan from a package: same start date and length, and the
// interests its days cover.
export function planSeed(p: TripPackage, departure = p.departures[0]?.date) {
  const start = departure;
  const end = new Date(
    Date.parse(start + "T12:00:00Z") + (p.route.length - 1) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  return {
    title: p.title,
    draftName: `My version of ${p.title}`.slice(0, 80),
    startDate: start,
    endDate: end,
  };
}
