// Checks and prices one cart line against the live listing or trip. The cart
// page, the checkout quote and checkout itself all use this, so the server
// reaches the same total the traveller was shown.
import type { PublishedExperience } from "../../catalogue/domain/experience";
import {
  cancellationLabel,
  listingDetails,
} from "../../catalogue/domain/listing-details";
import { displayName } from "../../catalogue/domain/experience-content";
import { lagosToday } from "../../catalogue/domain/events";
import {
  lagosInstant,
  runsOn,
  shortDay,
  startTimesOn,
} from "../../catalogue/domain/schedule";
import {
  departureCapacity,
  type TripPackage,
} from "../../catalogue/domain/packages";
import {
  experienceLinePrice,
  packageLinePrice,
  sumRows,
  type CartLine,
  type PriceRow,
} from "./cart";

// A product as the bookings module sees it. `productId` is the catalogue id
// for listings and the slug for trips; `partnerId` is null for listings
// Fastlife runs itself.
export type Bookable =
  | {
      kind: "EXPERIENCE";
      productId: string;
      partnerId: string | null;
      listing: PublishedExperience;
    }
  | {
      kind: "PACKAGE";
      productId: string;
      partnerId: string | null;
      trip: TripPackage;
    };

// The booked policy, stored with the line so later listing edits don't
// change what the traveller agreed to.
export type LineTerms = {
  operator: string;
  where: string;
  confirmation: "INSTANT" | "PARTNER";
  partnerHours: number;
  freeCancellationHours: number | null;
  cancellation: string;
};

export type CapacityUnit = "PERSON" | "GROUP" | "SEAT";

// The sellable start this line takes places from.
export type SlotRef = {
  productType: "EXPERIENCE" | "PACKAGE";
  productId: string;
  partnerId: string | null;
  localDate: string;
  // "HH:MM" for fixed sessions; "DAY" for drop-in listings and trips (D3).
  startTime: string;
  capacity: number;
  capacityUnit: CapacityUnit;
  units: number;
};

export type ResolvedLine = {
  line: CartLine;
  title: string;
  rows: PriceRow[];
  totalMinor: number;
  terms: LineTerms | null;
  slot: SlotRef | null;
  problem?: string;
};

export const slotKey = (
  s: Pick<SlotRef, "productType" | "productId" | "localDate" | "startTime">,
) => `${s.productType}|${s.productId}|${s.localDate}|${s.startTime}`;

function missing(line: CartLine, title: string, problem: string) {
  return {
    line,
    title,
    rows: [],
    totalMinor: 0,
    terms: null,
    slot: null,
    problem,
  };
}

function resolveExperience(
  line: CartLine & { kind: "EXPERIENCE" },
  product: Extract<Bookable, { kind: "EXPERIENCE" }>,
  now: number,
): ResolvedLine {
  const e = product.listing;
  const d = listingDetails(e);
  const guests = line.adults + line.children;
  const pickup = d.arrival !== "SELF" && line.pickup;
  const rows = experienceLinePrice(
    { adults: line.adults, children: line.children, pickup },
    e.offer,
    d,
  );
  const fixed =
    e.schedulingType === "FIXED" || (e.sessions ?? []).some((s) => s.dates);
  const session = e.sessions?.find((s) => s.startTime === line.time);
  const unit: CapacityUnit =
    e.offer.capacityUnit === "GROUP" ? "GROUP" : "PERSON";
  const day = shortDay(line.date);
  const today = lagosToday(now);
  const tooLate =
    lagosInstant(line.date, line.time) - now <
    e.offer.bookingCutoffHours * 3600000;
  const problem =
    line.date < today || !runsOn(e, line.date)
      ? `No longer runs on ${day}.`
      : tooLate
        ? `Too late to book ${day} at ${line.time}.`
        : !startTimesOn(e, line.date, now).includes(line.time) &&
            !startTimesOn(e, line.date).includes(line.time)
          ? `The ${line.time} start on ${day} is no longer offered.`
          : line.childAges.length !== line.children
            ? "Add each child’s age before checkout."
            : line.adults < 1
              ? "At least one adult has to come."
              : guests < e.offer.minParty || guests > e.offer.maxParty
                ? `This takes ${e.offer.minParty}–${e.offer.maxParty} guests.`
                : line.children && d.minAge >= 18
                  ? "Adults only (18+)."
                  : line.childAges.some((a) => a < d.minAge)
                    ? `Children must be at least ${d.minAge}.`
                    : (pickup || d.arrival === "PICKUP_REQUIRED") &&
                        !line.pickupAddress.trim()
                      ? "Add the pickup address."
                      : undefined;
  return {
    line,
    title: displayName(e.name),
    rows,
    totalMinor: sumRows(rows),
    terms: {
      operator: d.operator.replace(/ \(sample.*\)$/, ""),
      where:
        pickup || d.arrival === "PICKUP_REQUIRED"
          ? `Pickup from ${line.pickupAddress}`
          : d.venue,
      confirmation: d.confirmation,
      partnerHours: d.partnerHours,
      freeCancellationHours: d.freeCancellationHours,
      cancellation: cancellationLabel(d),
    },
    slot: {
      productType: "EXPERIENCE",
      productId: product.productId,
      partnerId: product.partnerId,
      localDate: line.date,
      startTime: fixed && e.kind !== "FULL_DAY" ? line.time : "DAY",
      capacity: session?.capacity ?? e.offer.capacityPerSlot,
      capacityUnit: unit,
      units: unit === "GROUP" ? 1 : guests,
    },
    problem,
  };
}

// Ready-made trips are confirmed by their operator within this many hours.
export const packageConfirmHours = 48;

function resolvePackage(
  line: CartLine & { kind: "PACKAGE" },
  product: Extract<Bookable, { kind: "PACKAGE" }>,
  now: number,
): ResolvedLine {
  const p = product.trip;
  const departure = p.departures.find((d) => d.date === line.date);
  const rows = packageLinePrice(line, p);
  return {
    line,
    title: p.title,
    rows,
    totalMinor: sumRows(rows),
    terms: {
      operator: p.operator,
      where: `Starts in ${p.startCity}`,
      confirmation: "PARTNER",
      partnerHours: packageConfirmHours,
      freeCancellationHours: null,
      cancellation: p.bookingTerms[1] ?? p.bookingTerms[0] ?? "",
    },
    slot: {
      productType: "PACKAGE",
      productId: product.productId,
      partnerId: product.partnerId,
      localDate: line.date,
      startTime: "DAY",
      capacity: departure ? departureCapacity(departure) : 0,
      capacityUnit: "SEAT",
      units: line.travellers,
    },
    problem:
      !departure || departure.seats === "FULL" || line.date < lagosToday(now)
        ? "This departure is no longer available."
        : line.singleRooms > line.travellers
          ? "More single rooms than travellers."
          : undefined,
  };
}

export function resolveLine(
  line: CartLine,
  product: Bookable | undefined,
  now: number,
): ResolvedLine {
  if (line.kind === "PACKAGE")
    return product?.kind === "PACKAGE"
      ? resolvePackage(line, product, now)
      : missing(line, "Ready-made trip", "This trip is no longer offered.");
  return product?.kind === "EXPERIENCE"
    ? resolveExperience(line, product, now)
    : missing(line, "Activity", "This activity is no longer listed.");
}

// Which product a line refers to: listings by offer id, trips by slug.
export const productRef = (line: CartLine) =>
  line.kind === "PACKAGE"
    ? { kind: "PACKAGE" as const, key: line.packageSlug }
    : { kind: "EXPERIENCE" as const, key: line.offerId };

const unitWords: Record<CapacityUnit, [string, string]> = {
  PERSON: ["place", "places"],
  GROUP: ["group booking", "group bookings"],
  SEAT: ["seat", "seats"],
};

// Shown when there isn't room, or when few places are left (C5).
export function availabilityNote(slot: SlotRef, remaining: number) {
  const [one, many] = unitWords[slot.capacityUnit];
  if (remaining <= 0) return { problem: "Sold out for this date." };
  if (slot.units > remaining)
    return {
      problem: `Only ${remaining} ${remaining === 1 ? one : many} left for this date.`,
    };
  if (remaining <= 3)
    return { low: `${remaining} ${remaining === 1 ? one : many} left` };
  return {};
}
