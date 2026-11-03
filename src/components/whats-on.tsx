"use client";
import { useEffect, useState } from "react";
import type { Experience } from "@/server/catalogue";
import {
  displayName,
  formatMoney,
  priceBasisLabel,
  zoneLabel,
} from "@/domain/experience-content";
import {
  eventDates,
  eventTypeLabels,
  eventsInWindow,
  lagosToday,
  upcomingEvents,
} from "@/domain/events";
import { useTripDates } from "@/hooks/use-trip-dates";
import { BucketButton } from "./bucket";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";

type Record = Experience & { seedKey?: string };

export function rangeLabel(start: string, end: string) {
  const format = (value: string, withYear: boolean) =>
    new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${format(start, false)} – ${format(end, true)}`;
}

let cataloguePromise: Promise<Record[]> | null = null;
function loadCatalogue() {
  cataloguePromise ??= fetch("/api/v1/experiences")
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.message);
      // Onboarding must keep working even if the catalogue is unavailable.
      return (Array.isArray(body?.data) ? body.data : []) as Record[];
    })
    .catch((error) => {
      cataloguePromise = null;
      throw error;
    });
  return cataloguePromise;
}

// One dated event as an agenda row: the date leads, as it is the reason to
// care about an event, then what it is, when and where, and the price.
function AgendaItem({
  experience: e,
  start,
  end,
}: {
  experience: Record;
  start?: string;
  end?: string;
}) {
  const dates = eventDates(e, start, end);
  const first = dates[0];
  const part = (option: Intl.DateTimeFormatOptions) =>
    new Date(first + "T12:00:00Z").toLocaleDateString("en-GB", {
      ...option,
      timeZone: "UTC",
    });
  const time = e.sessions?.find((s) => s.dates?.includes(first))?.startTime;
  const more = dates.length - 1;
  const name = displayName(e.name);
  return (
    <li className="agenda-item event-card">
      <time className="agenda-date" dateTime={first}>
        <span>{part({ weekday: "short" })}</span>
        <strong>{part({ day: "numeric" })}</strong>
        <span>{part({ month: "short" })}</span>
      </time>
      <div className="agenda-thumb">
        <ExperienceOverlay
          experience={e}
          triggerStyle="image"
          trigger={
            <img
              src={e.imagePath}
              loading="lazy"
              alt={e.inspirationPhoto?.title ?? `View ${name}`}
            />
          }
        />
      </div>
      <div className="agenda-body">
        {e.event && (
          <p className="agenda-type">{eventTypeLabels[e.event.type]}</p>
        )}
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={name}
            triggerStyle="title"
          />
        </h3>
        <p className="agenda-meta">
          {[
            time,
            zoneLabel(e.zoneId),
            more ? `+${more} more ${more === 1 ? "date" : "dates"}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="agenda-side">
        <p className="agenda-price">
          <strong>{formatMoney(e.offer.rateMinor)}</strong>{" "}
          {priceBasisLabel(e.offer.priceBasis)}
        </p>
        <BucketButton id={e.offer.id} variant="compact" />
      </div>
    </li>
  );
}

function Agenda({
  events,
  start,
  end,
  label,
  limit,
}: {
  events: Record[];
  start?: string;
  end?: string;
  label: string;
  // Rows shown before "Show all"; every row shows when omitted.
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = limit && !expanded ? events.slice(0, limit) : events;
  return (
    <>
      <ol className="agenda" aria-label={label}>
        {shown.map((e) => (
          <AgendaItem key={e.id} experience={e} start={start} end={end} />
        ))}
      </ol>
      {shown.length < events.length && (
        <button
          type="button"
          className="agenda-more"
          onClick={() => setExpanded(true)}
        >
          Show all {events.length} events
          <Icon name="chevronDown" size={16} />
        </button>
      )}
    </>
  );
}

// Explore: events during the traveller's dates, or everything coming up.
export function WhatsOn({ records }: { records: Record[] }) {
  const dates = useTripDates();
  const [showAll, setShowAll] = useState(false);
  const today = lagosToday();
  const upcoming = upcomingEvents(records, today);
  if (!upcoming.length) return null;
  const windowed = dates && !showAll ? dates : null;
  const shown = windowed
    ? eventsInWindow(records, windowed.start, windowed.end)
    : upcoming;
  return (
    <section className="whats-on" aria-labelledby="whats-on-title">
      <div className="whats-on-header">
        <div>
          <p className="eyebrow">What’s on</p>
          <h2 id="whats-on-title">
            {windowed ? "Happening during your trip" : "Coming up in Lagos"}
          </h2>
          <p>
            {windowed
              ? `${rangeLabel(windowed.start, windowed.end)} · concerts, festivals and more on fixed dates`
              : "Concerts, festivals, carnival, conferences and studio visits"}
          </p>
        </div>
        {dates && (
          <div
            className="segmented segmented--small"
            role="group"
            aria-label="Show events"
          >
            <button
              type="button"
              aria-pressed={!showAll}
              onClick={() => setShowAll(false)}
            >
              During my dates
            </button>
            <button
              type="button"
              aria-pressed={showAll}
              onClick={() => setShowAll(true)}
            >
              All upcoming
            </button>
          </div>
        )}
      </div>
      {shown.length ? (
        <Agenda
          key={windowed ? "trip" : "all"}
          events={shown}
          start={windowed ? windowed.start : today}
          end={windowed?.end}
          label={windowed ? "Events during your trip" : "Upcoming events"}
          limit={4}
        />
      ) : (
        <p className="whats-on-empty">
          Nothing dated falls within your trip yet.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setShowAll(true)}
          >
            See all upcoming events
          </button>
        </p>
      )}
    </section>
  );
}

// Onboarding: shown as soon as the traveller has picked dates.
export function TripEvents({ start, end }: { start: string; end: string }) {
  const [records, setRecords] = useState<Record[] | null>(null);
  useEffect(() => {
    let active = true;
    loadCatalogue()
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch(() => {
        if (active) setRecords([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(end) &&
    end >= start;
  if (!records || !valid) return null;
  const events = eventsInWindow(records, start, end);
  return (
    <section className="trip-events" aria-labelledby="trip-events-title">
      <h3 id="trip-events-title">
        <Icon name="sparkle" size={16} />
        Happening during your dates
        {events.length > 0 && (
          <span className="count-badge">{events.length}</span>
        )}
      </h3>
      {events.length ? (
        <>
          <p>
            Add any you like to your bucket. Nothing is booked, and each event
            only fits on the days it runs.
          </p>
          <Agenda
            events={events}
            start={start}
            end={end}
            label="Events during your dates"
          />
        </>
      ) : (
        <p>
          No concerts, festivals or set visits are listed for{" "}
          {rangeLabel(start, end)} yet.
        </p>
      )}
    </section>
  );
}
