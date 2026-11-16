// When a listing runs, for browsing by date. Uses the same weekday, session
// and unavailable-date rules as the planner; it does not know remaining
// capacity, so the UI says "runs", never "available".
import type { Experience } from "./experience";

type Scheduled = Pick<
  Experience,
  | "availabilityLocal"
  | "durationMinMinutes"
  | "kind"
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

// Start times offered on a date: fixed sessions, the opening time for a full
// day, or hourly starts that still finish by closing time.
export function startTimesOn(e: Scheduled, date: string) {
  if (!isoDate.test(date) || e.unavailableDates?.includes(date)) return [];
  const dated = (e.sessions ?? []).filter((s) => s.dates);
  if (dated.length)
    return dated.filter((s) => s.dates!.includes(date)).map((s) => s.startTime);
  if (!e.availabilityLocal.days.includes(weekday(date))) return [];
  if (e.schedulingType === "FIXED" && e.sessions?.length)
    return e.sessions.map((s) => s.startTime);
  const opens = minutes(e.availabilityLocal.opensAt);
  if (e.kind === "FULL_DAY") return [clock(opens)];
  const last = minutes(e.availabilityLocal.closesAt) - e.durationMinMinutes;
  const times: string[] = [];
  for (let t = opens; t <= last; t += 60) times.push(clock(t));
  return times;
}

export function runsOn(e: Scheduled, date: string) {
  return startTimesOn(e, date).length > 0;
}

// The next dates a listing runs, for date pickers and card hints.
export function nextRunDates(e: Scheduled, from: string, count = 6) {
  const dates: string[] = [];
  for (let i = 0; i < 120 && dates.length < count; i++) {
    const date = addDays(from, i);
    if (runsOn(e, date)) dates.push(date);
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
