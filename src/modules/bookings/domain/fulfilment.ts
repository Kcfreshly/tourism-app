// After a trip is paid: one row per thing Fastlife is arranging, each with
// the status the traveller sees, and on the arrival day the arranged items
// (airport pickup, stay check-in) that start the day view. Built from the
// order, its bookings, service requests and stay offers, and the trip's
// profile. See docs/CUSTOMER_ONBOARDING_TODO.md, sections 3 and 4.
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  airports,
  stayChoiceLabel,
  stayRecommendHours,
  stayTypes,
} from "../../trips/domain/profile";
import { bookingStatusLabels, type OrderView } from "./checkout";
import { assigneeLines } from "./service-request";
import { nights, stayOpen } from "./stay-offer";
import { serviceStatusLabel, serviceTitles } from "./trip-checkout";

export type FulfilmentTone = "ok" | "wait" | "act" | "off";

export type FulfilmentRow = {
  key: "payment" | "pickup" | "stay" | "services" | "activities";
  title: string;
  status: string;
  tone: FulfilmentTone;
  lines: string[];
  // Stay offers the traveller can approve and pay for now.
  approve?: { offerId: string; propertyName: string; priceMinor: number }[];
  // What an unmatched or declined part refunds.
  refund?: string;
};

const lagosTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

const refundLine = (minor: number) =>
  minor > 0 ? `Refund due: ${formatMoney(minor)} to the way you paid.` : "";

// When we promised stay recommendations by: 48 hours after payment.
export function stayRespondBy(order: Pick<OrderView, "createdAt">) {
  return new Date(
    Date.parse(order.createdAt) + stayRecommendHours * 3600000,
  ).toISOString();
}

function pickupRow(order: OrderView): FulfilmentRow | null {
  const s = order.services.find((x) => x.service === "AIRPORT_PICKUP");
  if (!s) return null;
  const a = order.trip?.airportPickup;
  const flight = a
    ? [
        `${a.flight ? `Flight ${a.flight}` : "Flight number to add"} · ${airports[a.airport]}`,
        `Lands ${shortDay(a.landingDate)}${a.landingTime ? ` at ${clockLabel(a.landingTime)}` : ", time to add"}`,
      ]
    : [`${shortDay(s.date)} · ${s.label}`];
  const base = { key: "pickup" as const, title: serviceTitles[s.service] };
  if (s.status === "REQUESTED")
    return {
      ...base,
      status: "Finding your driver",
      tone: "wait",
      lines: [...flight, `Matched by ${lagosTime(s.matchBy)}`],
    };
  if (s.status === "MATCHED")
    return {
      ...base,
      status: "Driver matched",
      tone: "ok",
      lines: [
        ...flight,
        assigneeLines(s.service, s.assignee)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · "),
      ],
    };
  if (s.status === "COMPLETED")
    return { ...base, status: "Done", tone: "ok", lines: flight };
  return {
    ...base,
    status: serviceStatusLabel(s.service, s.status),
    tone: "off",
    lines: flight,
    refund: s.status === "UNMATCHED" ? refundLine(s.totalMinor) : undefined,
  };
}

function stayRow(order: OrderView, now: Date): FulfilmentRow | null {
  const booked = order.stays.find((st) => st.status === "BOOKED");
  const open = order.stays.filter((st) => stayOpen(st, now));
  const wanted = order.trip?.accommodationBy === "FASTLIFE";
  if (!booked && !open.length && !wanted && !order.stays.length) return null;
  const base = { key: "stay" as const, title: "Stay" };
  if (booked) {
    const n = nights(booked);
    return {
      ...base,
      status: "Booked",
      tone: "ok",
      lines: [
        booked.propertyName,
        `${shortDay(booked.checkIn)} – ${shortDay(booked.checkOut)} · ${n} ${n === 1 ? "night" : "nights"} · ${booked.room}`,
        `${booked.address} · ${booked.area}`,
      ],
    };
  }
  if (open.length)
    return {
      ...base,
      status: "Hotel ready: approve and pay",
      tone: "act",
      lines: open.map(
        (st) =>
          `${st.propertyName} · ${formatMoney(st.priceMinor)} · held until ${lagosTime(st.availableUntil)}`,
      ),
      approve: open.map((st) => ({
        offerId: st.id,
        propertyName: st.propertyName,
        priceMinor: st.priceMinor,
      })),
    };
  const stay = order.trip?.stay;
  return {
    ...base,
    status: "Finding options",
    tone: "wait",
    lines: [
      stay
        ? [stayTypes[stay.type], stayChoiceLabel(stay.choice)].join(" · ")
        : "We’re finding places that suit your trip.",
      !stay || stay.choice.kind === "RECOMMEND"
        ? `We’ll send stay recommendations by ${lagosTime(stayRespondBy(order))}.`
        : "We’re checking it and will send you the offer to approve.",
    ],
  };
}

function servicesRow(order: OrderView): FulfilmentRow | null {
  const all = order.services.filter((s) => s.service !== "AIRPORT_PICKUP");
  if (!all.length) return null;
  const done = all.filter((s) => ["MATCHED", "COMPLETED"].includes(s.status));
  const unmatched = all.filter((s) => s.status === "UNMATCHED");
  const waiting = all.filter((s) => s.status === "REQUESTED");
  return {
    key: "services",
    title: "Cars and guides",
    status: waiting.length
      ? `Finding · ${done.length} of ${all.length} matched`
      : unmatched.length
        ? `${done.length} of ${all.length} matched`
        : "Matched",
    tone: waiting.length ? "wait" : unmatched.length ? "off" : "ok",
    lines: [...all]
      .sort((a, b) =>
        (a.date + a.startTime).localeCompare(b.date + b.startTime),
      )
      .map(
        (s) =>
          `${shortDay(s.date)} · ${serviceTitles[s.service]} · ${serviceStatusLabel(s.service, s.status)}`,
      ),
    refund: unmatched.length
      ? refundLine(unmatched.reduce((n, s) => n + s.totalMinor, 0))
      : undefined,
  };
}

function activitiesRow(order: OrderView): FulfilmentRow | null {
  const all = order.bookings;
  if (!all.length) return null;
  const declined = all.filter((b) =>
    ["DECLINED", "CANCELLED"].includes(b.status),
  );
  const waiting = all.filter((b) => b.status === "AWAITING_PARTNER");
  return {
    key: "activities",
    title: "Activities and events",
    status: waiting.length
      ? "Waiting for the operator"
      : declined.length === all.length
        ? "Not available"
        : "Confirmed",
    tone: waiting.length
      ? "wait"
      : declined.length === all.length
        ? "off"
        : "ok",
    lines: all.map(
      (b) =>
        `${b.title} · ${shortDay(b.date)}${b.startTime ? ` · ${clockLabel(b.startTime)}` : ""} · ${bookingStatusLabels[b.status]}`,
    ),
    refund: declined.length
      ? refundLine(declined.reduce((n, b) => n + b.totalMinor, 0))
      : undefined,
  };
}

// The tracker, with anything the traveller must act on first.
export function fulfilmentRows(order: OrderView, now: Date): FulfilmentRow[] {
  const rows: FulfilmentRow[] = [
    {
      key: "payment",
      title: "Payment",
      status: "Received",
      tone: "ok",
      lines: [
        `${formatMoney(order.totalMinor)} paid ${lagosTime(order.createdAt)}`,
      ],
    },
    pickupRow(order),
    stayRow(order, now),
    servicesRow(order),
    activitiesRow(order),
  ].filter((r): r is FulfilmentRow => !!r);
  return [
    ...rows.filter((r) => r.tone === "act"),
    ...rows.filter((r) => r.tone !== "act"),
  ];
}

// Everything is settled: nothing waiting on us or on the traveller.
export function fulfilmentSettled(rows: FulfilmentRow[]) {
  return rows.every((r) => r.tone === "ok" || r.tone === "off");
}

export type ArrangedItem = {
  key: string;
  kind: "PICKUP" | "CHECK_IN";
  // Lagos time, or empty when not known yet.
  time: string;
  title: string;
  lines: string[];
};

// What Fastlife arranged on a day, in the order it happens: the airport
// pickup, then checking in at the booked stay. The planned items follow.
export function arrangedFor(day: string, order: OrderView): ArrangedItem[] {
  const items: ArrangedItem[] = [];
  const s = order.services.find(
    (x) =>
      x.service === "AIRPORT_PICKUP" &&
      x.date === day &&
      !["UNMATCHED", "CANCELLED"].includes(x.status),
  );
  if (s) {
    const a = order.trip?.airportPickup;
    const time = a?.landingTime || (s.startTime !== "00:00" ? s.startTime : "");
    const driver = assigneeLines(s.service, s.assignee);
    items.push({
      key: `pickup:${s.id}`,
      kind: "PICKUP",
      time,
      title: "Airport pickup",
      lines: [
        a
          ? `${a.flight ? `Flight ${a.flight}` : "Flight number to add"} · ${airports[a.airport]}`
          : s.label,
        time ? `Lands ${clockLabel(time)}` : "Landing time to add",
        driver.length
          ? driver.map(([k, v]) => `${k}: ${v}`).join(" · ")
          : "Finding your driver",
      ],
    });
  }
  const stay = order.stays.find(
    (st) => st.status === "BOOKED" && st.checkIn === day,
  );
  if (stay)
    items.push({
      key: `check-in:${stay.id}`,
      kind: "CHECK_IN",
      time: "",
      title: `Check in at ${stay.propertyName}`,
      lines: [`${stay.address} · ${stay.area}`, stay.room],
    });
  return items;
}

// Whole days until the trip starts, counted on Lagos dates.
export function daysUntil(startDate: string, today: string) {
  return Math.round((Date.parse(startDate) - Date.parse(today)) / 86400000);
}
