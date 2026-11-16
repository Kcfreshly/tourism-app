// Booking-facing details for a listing: who runs it, where it happens, how
// people get there, who it suits and how it is confirmed. The demo catalogue
// has none of these yet, so this module supplies labelled sample values keyed
// by catalogue seed key. Real listings will carry them in the catalogue record.
import type { Experience } from "./experience";
import { zoneLabel } from "./experience-content";

export type ArrivalMode = "SELF" | "PICKUP_OPTIONAL" | "PICKUP_REQUIRED";
export type ConfirmationMode = "INSTANT" | "PARTNER";

export type ListingDetails = {
  operator: string;
  venue: string;
  arrival: ArrivalMode;
  pickupRateMinor: number;
  minAge: number;
  familySuitable: boolean;
  // Per child where the price is per adult; children count towards a group.
  childRateMinor: number;
  confirmation: ConfirmationMode;
  partnerHours: number;
  freeCancellationHours: number;
};

type Sample = Partial<ListingDetails>;

const samples: Record<string, Sample> = {
  "nature-walk": {
    operator: "Lekki Trails (sample partner)",
    venue: "Conservation centre gate, Lekki",
    minAge: 5,
    childRateMinor: 600000,
  },
  gallery: {
    operator: "Art House Tours (sample partner)",
    venue: "Gallery reception, Lekki",
    minAge: 8,
    childRateMinor: 400000,
  },
  "local-market": {
    operator: "Market Hosts Collective (sample partner)",
    venue: "Market main entrance, Lagos Island",
    arrival: "PICKUP_OPTIONAL",
    pickupRateMinor: 1500000,
    minAge: 12,
    confirmation: "PARTNER",
    partnerHours: 24,
  },
  suya: {
    operator: "Night Grill Hosts (sample partner)",
    venue: "Suya spot, Surulere",
    minAge: 18,
  },
  beach: {
    operator: "Coastline Days (sample partner)",
    venue: "Beach resort gate, Lekki",
    arrival: "PICKUP_OPTIONAL",
    pickupRateMinor: 1200000,
    minAge: 0,
    childRateMinor: 750000,
  },
  cooking: {
    operator: "Home Kitchen Lagos (sample partner)",
    venue: "Host's home kitchen, Lekki Phase 1",
    minAge: 12,
    childRateMinor: 1000000,
    confirmation: "PARTNER",
    partnerHours: 24,
  },
  music: {
    operator: "Live Rooms (sample partner)",
    venue: "Music lounge, Victoria Island",
    minAge: 18,
  },
  makers: {
    operator: "Style Makers Lagos (sample partner)",
    venue: "Studio collective, Victoria Island",
    minAge: 12,
    childRateMinor: 450000,
  },
  gardens: {
    operator: "Green Corners (sample partner)",
    venue: "Garden entrance, Lekki",
    minAge: 0,
    childRateMinor: 0,
  },
  games: {
    operator: "Play Social (sample partner)",
    venue: "Games lounge, Lekki",
    minAge: 8,
    childRateMinor: 300000,
  },
  history: {
    operator: "Heritage Days (sample partner)",
    venue: "Pickup from your address",
    arrival: "PICKUP_REQUIRED",
    minAge: 10,
    confirmation: "PARTNER",
    partnerHours: 48,
  },
  neighbourhood: {
    operator: "Street Stories (sample partner)",
    venue: "Meeting point near Tafawa Balewa Square",
    minAge: 10,
  },
  "event-studio-set": {
    operator: "Studio Sessions (sample partner)",
    minAge: 16,
    confirmation: "PARTNER",
    partnerHours: 48,
  },
  "event-food-music-festival": {
    operator: "Festive Lagos (sample organiser)",
    venue: "Festival grounds, Victoria Island",
    minAge: 0,
    childRateMinor: 1000000,
  },
  "event-street-carnival": {
    operator: "Carnival Hosts (sample partner)",
    arrival: "PICKUP_OPTIONAL",
    pickupRateMinor: 1500000,
    minAge: 8,
    childRateMinor: 1500000,
  },
};

export function listingDetails(
  e: Pick<Experience, "id" | "zoneId" | "supplierName" | "offer"> & {
    seedKey?: string;
  },
): ListingDetails {
  const sample = samples[e.seedKey ?? e.id] ?? {};
  const minAge = sample.minAge ?? e.offer.minAge;
  return {
    operator: sample.operator ?? e.supplierName,
    venue: sample.venue ?? `${zoneLabel(e.zoneId)} (sample venue)`,
    arrival: sample.arrival ?? "SELF",
    pickupRateMinor: sample.pickupRateMinor ?? 0,
    minAge,
    familySuitable: minAge <= 12,
    childRateMinor: sample.childRateMinor ?? e.offer.rateMinor,
    confirmation: sample.confirmation ?? "INSTANT",
    partnerHours: sample.partnerHours ?? 0,
    freeCancellationHours: sample.freeCancellationHours ?? 48,
  };
}

export function ageLabel(d: Pick<ListingDetails, "minAge">) {
  if (d.minAge >= 18) return "Adults only (18+)";
  if (d.minAge <= 0) return "All ages";
  return `Ages ${d.minAge}+`;
}

export function confirmationLabel(
  d: Pick<ListingDetails, "confirmation" | "partnerHours">,
) {
  return d.confirmation === "INSTANT"
    ? "Instant confirmation"
    : `Partner confirms within ${d.partnerHours} h`;
}

export function arrivalLabel(d: Pick<ListingDetails, "arrival">) {
  return d.arrival === "SELF"
    ? "Make your own way"
    : d.arrival === "PICKUP_REQUIRED"
      ? "Pickup included"
      : "Make your own way, or add pickup";
}

export function cancellationLabel(
  d: Pick<ListingDetails, "freeCancellationHours">,
) {
  return `Free cancellation up to ${d.freeCancellationHours} hours before`;
}
