// Checkout helpers: which trip days are still empty, and the priced lines
// regrouped by day so travellers can see what each day costs.
import { tripDays, type Item, type PriceLine } from "./planner";
import type { Profile } from "./profile";

export function unplannedDays(
  profile: Pick<Profile, "startDate" | "endDate">,
  items: Pick<Item, "localDate">[],
) {
  return tripDays(profile).filter(
    (day) => !items.some((item) => item.localDate === day),
  );
}

export type DayLine = PriceLine & { time?: string };
export type DayCost = { day: string; lines: DayLine[]; totalMinor: number };

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

// Price lines carry their day in the key: an activity line is keyed by its
// item id, transport and full-day guide lines by `<kind>:<date>`, and an
// activity guide by `guide:<item id>`.
export function lineDay(line: Pick<PriceLine, "key">, items: Item[]) {
  const [kind, rest] = line.key.includes(":")
    ? [
        line.key.slice(0, line.key.indexOf(":")),
        line.key.slice(line.key.indexOf(":") + 1),
      ]
    : ["", line.key];
  if (isoDay.test(rest)) return rest;
  const item = items.find((i) => i.id === (kind === "guide" ? rest : line.key));
  return item?.localDate;
}

export function costByDay(
  profile: Pick<Profile, "startDate" | "endDate">,
  lines: PriceLine[],
  items: Item[],
): DayCost[] {
  return tripDays(profile).map((day) => {
    const dayLines = lines
      .filter((line) => lineDay(line, items) === day)
      .map((line) => {
        const item = items.find(
          (i) => i.id === line.key || `guide:${i.id}` === line.key,
        );
        return {
          ...line,
          // Lines already sit under their day heading.
          label: line.label.replace(/^\d{4}-\d{2}-\d{2} · /, ""),
          time: item ? `${item.startTime}–${item.endTime}` : undefined,
        };
      })
      .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return {
      day,
      lines: dayLines,
      totalMinor: dayLines.reduce((n, line) => n + line.totalMinor, 0),
    };
  });
}
