// Dated events (concerts, festivals, carnival, conferences, studio visits) are
// fixed-session experiences whose sessions only run on listed dates. The
// planner's session rules already enforce those dates; this module only finds
// and describes the events that fall inside a traveller's dates.

export type EventType =
  "CONCERT" | "FESTIVAL" | "CARNIVAL" | "CONFERENCE" | "STUDIO";

export type EventInfo = {
  type: EventType;
  // What every booking includes, and what may happen but is never promised.
  guaranteed?: string;
  bonus?: string;
};

type Dated = {
  event?: EventInfo;
  sessions?: { startTime: string; dates?: string[] }[];
};

export const eventTypeLabels: Record<EventType, string> = {
  CONCERT: "Concert",
  FESTIVAL: "Festival",
  CARNIVAL: "Carnival",
  CONFERENCE: "Conference",
  STUDIO: "Studio visit",
};

export function isEvent(e: Dated) {
  return !!e.event;
}

export function eventDates(e: Dated, start?: string, end?: string) {
  return [...new Set((e.sessions ?? []).flatMap((s) => s.dates ?? []))]
    .filter((d) => (!start || d >= start) && (!end || d <= end))
    .sort();
}

export function eventsInWindow<T extends Dated>(
  records: T[],
  start: string,
  end: string,
) {
  return records
    .filter((e) => isEvent(e) && eventDates(e, start, end).length)
    .sort((a, b) =>
      eventDates(a, start, end)[0].localeCompare(eventDates(b, start, end)[0]),
    );
}

export function upcomingEvents<T extends Dated>(records: T[], today: string) {
  return eventsInWindow(records, today, "9999-12-31");
}

export function eventDay(date: string) {
  const value = new Date(date + "T12:00:00Z");
  return Number.isNaN(value.getTime())
    ? date
    : value.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
}

// "Sat 14 Nov · 19:00", or "Thu 12 Nov · 14:00 · +2 more dates".
export function eventWhen(e: Dated, start?: string, end?: string) {
  const dates = eventDates(e, start, end);
  if (!dates.length) return "";
  const time = e.sessions?.find((s) => s.dates?.includes(dates[0]))?.startTime;
  const more = dates.length - 1;
  return [
    eventDay(dates[0]),
    time,
    more ? `+${more} more ${more === 1 ? "date" : "dates"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function lagosToday(now = Date.now()) {
  return new Date(now + 3600000).toISOString().slice(0, 10);
}
