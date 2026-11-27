// A planned trip paid in one payment. Its activities hold places like cart
// lines; its cars, night cars and guides become service requests that staff
// match after payment, each refundable on its own if nobody is matched.
import type { Item, PriceLine, Services } from "../../trips/domain/planner";
import type { Profile } from "../../trips/domain/profile";
import { lagosInstant, shortDay } from "../../catalogue/domain/schedule";
import { lineFee, type CartLine, type PriceRow } from "./cart";
import {
  experienceSlot,
  experienceTerms,
  type Bookable,
  type LineTerms,
  type SlotRef,
} from "./resolve-line";

export const serviceKinds = [
  "CAR",
  "NIGHT_CAR",
  "FULL_DAY_GUIDE",
  "ACTIVITY_GUIDE",
  "AIRPORT_PICKUP",
] as const;
export type ServiceKind = (typeof serviceKinds)[number];

export const serviceStatuses = [
  "REQUESTED",
  "MATCHED",
  "COMPLETED",
  "UNMATCHED",
  "CANCELLED",
] as const;
export type ServiceStatus = (typeof serviceStatuses)[number];

// Drivers and guides are matched at least this long before they start, or
// the traveller is refunded for that service.
export const serviceNoticeHours = 48;

// A car or guide as bought: stored with its checkout line.
export type ServiceLine = {
  kind: "SERVICE";
  id: string;
  service: ServiceKind;
  date: string;
  startTime: string;
  label: string;
  matchBy: string;
};

const who: Record<ServiceKind, string> = {
  CAR: "driver",
  NIGHT_CAR: "night driver",
  FULL_DAY_GUIDE: "guide",
  ACTIVITY_GUIDE: "guide",
  AIRPORT_PICKUP: "driver",
};

export const serviceTitles: Record<ServiceKind, string> = {
  CAR: "Car and driver for the day",
  NIGHT_CAR: "Night car and driver",
  FULL_DAY_GUIDE: "Full-day guide",
  ACTIVITY_GUIDE: "Activity guide",
  AIRPORT_PICKUP: "Airport pickup",
};

export function serviceStatusLabel(service: ServiceKind, status: string) {
  if (status === "REQUESTED") return `Finding your ${who[service]}`;
  if (status === "MATCHED") return `Matched with your ${who[service]}`;
  if (status === "COMPLETED") return "Completed";
  if (status === "UNMATCHED") return `No ${who[service]} found, refund due`;
  return "Cancelled";
}

// The planned trip as checkout needs it, with the planner's price.
export type TripForCheckout = {
  profile: Pick<Profile, "adults" | "airportPickup">;
  items: Item[];
  services: Services;
  price: {
    lines: PriceLine[];
    subtotalMinor: number;
    feeMinor: number;
    totalMinor: number;
  };
};

// A priced line of a trip, before fees are shared out.
export type TripLine = {
  line: CartLine | ServiceLine;
  title: string;
  rows: PriceRow[];
  subtotalMinor: number;
  terms: LineTerms;
  slot: SlotRef | null;
};

const stripDay = (label: string) => label.replace(/^\d{4}-\d{2}-\d{2} · /, "");

// Splits the trip's one service fee across its lines, so one line can be
// refunded on its own later, while the total stays exactly the planner's.
export function shareFee(subtotals: number[], feeMinor: number) {
  const fees = subtotals.map(lineFee);
  const drift = feeMinor - fees.reduce((n, f) => n + f, 0);
  if (fees.length) fees[fees.length - 1] += drift;
  return fees;
}

// Turns the planner's priced lines into checkout lines. Every price line
// must land in exactly one checkout line, or the trip can't be paid.
export function tripCheckoutLines(
  trip: TripForCheckout,
  bookables: Bookable[],
  now: number,
): { lines: TripLine[]; problems: string[] } {
  const problems: string[] = [];
  const lines: TripLine[] = [];
  const used = new Set<string>();
  const itemById = new Map(trip.items.map((i) => [i.id, i]));
  const adults = trip.profile.adults;

  for (const price of trip.price.lines.filter(
    (l) => l.group === "activities",
  )) {
    const item = itemById.get(price.key);
    const product = bookables.find(
      (b) => b.kind === "EXPERIENCE" && b.listing.offer.id === item?.offerId,
    );
    used.add(price.key);
    if (!item || product?.kind !== "EXPERIENCE") {
      problems.push(
        `“${item?.title ?? price.label}” can’t be booked right now.`,
      );
      continue;
    }
    lines.push({
      line: {
        kind: "EXPERIENCE",
        id: item.id,
        offerId: product.listing.offer.id,
        date: item.localDate,
        time: item.startTime,
        adults,
        children: 0,
        childAges: [],
        pickup: false,
        pickupAddress: "",
      },
      title: item.title,
      rows: [
        {
          label:
            product.listing.offer.priceBasis === "PER_GROUP"
              ? `Group of ${adults}`
              : `${adults} ${adults === 1 ? "adult" : "adults"}`,
          totalMinor: price.totalMinor,
        },
      ],
      subtotalMinor: price.totalMinor,
      terms: experienceTerms(product.listing, "With your Fastlife transport"),
      slot: experienceSlot(product, item.localDate, item.startTime, adults),
    });
  }

  // One request per car, night car or guide. Cross-area surcharges belong
  // to that day's car.
  const service = (
    key: string,
    kind: ServiceKind,
    date: string,
    startTime: string,
    extraKeys: string[] = [],
  ) => {
    const priced = [key, ...extraKeys]
      .map((k) => trip.price.lines.find((l) => l.key === k))
      .filter((l): l is PriceLine => !!l);
    priced.forEach((l) => used.add(l.key));
    const starts = lagosInstant(date, startTime);
    if (starts - now < serviceNoticeHours * 3600000)
      problems.push(
        `${shortDay(date)}: drivers and guides need ${serviceNoticeHours} hours’ notice. Remove the ${serviceTitles[kind].toLowerCase()} or move the day.`,
      );
    const subtotal = priced.reduce((n, l) => n + l.totalMinor, 0);
    lines.push({
      line: {
        kind: "SERVICE",
        id: key,
        service: kind,
        date,
        startTime,
        label: stripDay(priced[0].label),
        matchBy: new Date(starts - serviceNoticeHours * 3600000).toISOString(),
      },
      title: serviceTitles[kind],
      rows: priced.map((l) => ({
        label: stripDay(l.label),
        totalMinor: l.totalMinor,
      })),
      subtotalMinor: subtotal,
      terms: {
        operator: "Fastlife",
        where: stripDay(priced[0].label),
        confirmation: "PARTNER",
        partnerHours: 0,
        freeCancellationHours: null,
        cancellation: `Refunded in full if we can’t match a ${who[kind]} ${serviceNoticeHours} hours before.`,
      },
      slot: null,
    });
  };

  for (const price of trip.price.lines) {
    const [kind, rest] = [
      price.key.slice(0, price.key.indexOf(":")),
      price.key.slice(price.key.indexOf(":") + 1),
    ];
    if (used.has(price.key) || !price.key.includes(":")) continue;
    if (kind === "vehicle")
      service(
        price.key,
        "CAR",
        rest,
        trip.services.vehicleWindows[rest]?.startTime ?? "08:00",
        [`cross-zone:${rest}`],
      );
    else if (kind === "night")
      service(
        price.key,
        "NIGHT_CAR",
        rest,
        trip.services.nightWindows?.[rest]?.startTime ?? "20:00",
        [`night-cross-zone:${rest}`],
      );
    else if (kind === "airport")
      // Without a landing time yet, the deadline counts from the start of
      // the landing day; staff see the flight details as they come in.
      service(
        price.key,
        "AIRPORT_PICKUP",
        rest,
        trip.profile.airportPickup?.landingTime || "00:00",
      );
    else if (kind === "guide" && itemById.has(rest)) {
      const item = itemById.get(rest)!;
      service(price.key, "ACTIVITY_GUIDE", item.localDate, item.startTime);
    } else if (kind === "guide")
      service(
        price.key,
        "FULL_DAY_GUIDE",
        rest,
        /(\d{2}:\d{2})–/.exec(price.label)?.[1] ?? "09:00",
      );
  }

  const unplaced = trip.price.lines.filter((l) => !used.has(l.key));
  if (unplaced.length)
    problems.push(
      `This trip has charges we can’t book yet: ${unplaced.map((l) => stripDay(l.label)).join(", ")}.`,
    );
  const subtotal = lines.reduce((n, l) => n + l.subtotalMinor, 0);
  if (!problems.length && subtotal !== trip.price.subtotalMinor)
    problems.push("The trip price changed. Reload checkout.");
  return { lines, problems };
}
