// When a listing runs, for browsing by date. Uses the same weekday, session
// and unavailable-date rules as the planner; it does not know remaining
// capacity, so the UI says "runs", never "available".
import type { Experience } from "./experience";

type Scheduled = Pick<
  Experience,
  | "availabilityLocal"
  | "durationMinMinutes"
  | "kind"
  | "offer"
  | "schedulingType"
  | "sessions"
  | "unavailableDates"
>;

export const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// 1 = Monday … 7 = Sunday, matching availabilityLocal.days.
export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay() || 7;
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

// The Saturday and Sunday of this weekend; only Sunday once it is Sunday.
export function weekendDates(today: string) {
  const day = weekday(today);
  if (day === 7) return [today];
  const saturday = addDays(today, 6 - day);
  return [saturday, addDays(saturday, 1)];
}

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function clock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

// Flexible listings are drop-in: a guest can arrive after opening and stay
// as little as this, as long as they leave by closing time.
export const flexibleMinStayMinutes = 60;

function isFixed(e: Pick<Scheduled, "schedulingType" | "sessions">) {
  return (
    e.schedulingType === "FIXED" || (e.sessions ?? []).some((s) => s.dates)
  );
}

// The shortest visit a booking can be: the listed length, or the drop-in
// minimum for flexible listings.
export function shortestVisit(
  e: Pick<
    Scheduled,
    "durationMinMinutes" | "kind" | "schedulingType" | "sessions"
  >,
) {
  return isFixed(e) || e.kind === "FULL_DAY"
    ? e.durationMinMinutes
    : Math.min(e.durationMinMinutes, flexibleMinStayMinutes);
}

// Milliseconds at a Lagos (UTC+1) wall-clock time.
export function lagosInstant(date: string, time: string) {
  return Date.parse(`${date}T${time}:00+01:00`);
}

// Start times offered on a date: fixed sessions, the opening time for a full
// day, or hourly starts that leave room for the shortest visit before
// closing. Given `now`, starts inside the booking cutoff are dropped, and a
// flexible listing that is already open offers the next quarter hour too.
export function startTimesOn(e: Scheduled, date: string, now?: number) {
  if (!isoDate.test(date) || e.unavailableDates?.includes(date)) return [];
  const dated = (e.sessions ?? []).filter((s) => s.dates);
  let times: string[];
  if (dated.length)
    times = dated
      .filter((s) => s.dates!.includes(date))
      .map((s) => s.startTime);
  else if (!e.availabilityLocal.days.includes(weekday(date))) return [];
  else if (e.schedulingType === "FIXED" && e.sessions?.length)
    times = e.sessions.map((s) => s.startTime);
  else if (e.kind === "FULL_DAY") times = [e.availabilityLocal.opensAt];
  else {
    const opens = minutes(e.availabilityLocal.opensAt);
    const last = minutes(e.availabilityLocal.closesAt) - shortestVisit(e);
    times = [];
    for (let t = opens; t <= last; t += 60) times.push(clock(t));
    if (now !== undefined) {
      const earliest =
        (now +
          e.offer.bookingCutoffHours * 3600000 -
          lagosInstant(date, "00:00")) /
        60000;
      const join = Math.ceil(earliest / 15) * 15;
      if (join > opens && join <= last && !times.includes(clock(join)))
        times = [...times, clock(join)].sort();
    }
  }
  if (now === undefined) return times;
  return times.filter(
    (t) => lagosInstant(date, t) - now >= e.offer.bookingCutoffHours * 3600000,
  );
}

export function runsOn(e: Scheduled, date: string, now?: number) {
  return startTimesOn(e, date, now).length > 0;
}

// The next dates a listing runs, for date pickers and card hints.
export function nextRunDates(
  e: Scheduled,
  from: string,
  count = 6,
  now?: number,
) {
  const dates: string[] = [];
  for (let i = 0; i < 120 && dates.length < count; i++) {
    const date = addDays(from, i);
    if (runsOn(e, date, now)) dates.push(date);
  }
  return dates;
}

export function shortDay(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function weeklyPattern(e: Scheduled) {
  if ((e.sessions ?? []).some((s) => s.dates)) return "Set dates";
  const days = e.availabilityLocal.days;
  return days.length === 7
    ? "Daily"
    : days.length === 2 && days.includes(6) && days.includes(7)
      ? "Weekends"
      : days.map((d) => dayNames[d]).join(", ");
}

// The days of a visit, for browsing "what's on while I'm here". Capped so a
// mistyped year can't produce thousands of days.
export const maxRangeDays = 62;
export function rangeDays(from: string, to: string) {
  if (!isoDate.test(from) || !isoDate.test(to) || to < from) return [];
  const days: string[] = [];
  for (let d = from; d <= to && days.length < maxRangeDays; d = addDays(d, 1))
    days.push(d);
  return days;
}

export function rangeText(from: string, to: string) {
  return from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;
}

// Price bands for browsing, on the listed price (per adult or per group).
export const priceBands = [
  { id: "under-10k", label: "Under ₦10,000", max: 1000000 },
  { id: "10k-25k", label: "₦10,000–₦25,000", min: 1000000, max: 2500000 },
  { id: "over-25k", label: "Over ₦25,000", min: 2500000 },
] as const;
export function inPriceBand(rateMinor: number, band: string) {
  const b = priceBands.find((p) => p.id === band);
  if (!b) return true;
  return (
    (!("min" in b) || rateMinor >= b.min) &&
    (!("max" in b) || rateMinor < b.max)
  );
}
