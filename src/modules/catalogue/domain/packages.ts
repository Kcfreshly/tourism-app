// Ready-made multi-day trips run by partner operators. Sample fixtures only:
// operators, departures, prices and inclusions are fictional.
import fixture from "../../../data/packages.demo.json";

export type TripPackage = (typeof fixture.packages)[number];
export type InclusionStatus =
  "INCLUDED" | "PARTIAL" | "ON_REQUEST" | "NOT_INCLUDED";

export const packages: TripPackage[] = fixture.packages;

export function packageBySlug(slug: string) {
  return packages.find((p) => p.slug === slug);
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
