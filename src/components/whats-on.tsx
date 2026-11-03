"use client";
import { useEffect, useState } from "react";
import type { Experience } from "@/server/catalogue";
import { eventsInWindow, lagosToday, upcomingEvents } from "@/domain/events";
import { useTripDates } from "@/hooks/use-trip-dates";
import { ExperienceCard } from "./catalogue-browser";
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

export function EventCard({
  experience,
  start,
  end,
}: {
  experience: Record;
  start?: string;
  end?: string;
}) {
  return (
    <ExperienceCard
      experience={experience}
      start={start}
      end={end}
      variant="row"
    />
  );
}

function EventRow({
  events,
  start,
  end,
  label,
}: {
  events: Record[];
  start?: string;
  end?: string;
  label: string;
}) {
  return (
    <ul className="event-row" aria-label={label}>
      {events.map((e) => (
        <li key={e.id}>
          <EventCard experience={e} start={start} end={end} />
        </li>
      ))}
    </ul>
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
              ? `${rangeLabel(windowed.start, windowed.end)}, from your trip details. Each event runs on its own dates only.`
              : "Concerts, festivals, carnival, conferences and studio visits. Each runs on its own dates only."}
          </p>
        </div>
        {dates && (
          <div className="segmented" role="group" aria-label="Show events">
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
        <EventRow
          events={shown}
          start={windowed ? windowed.start : today}
          end={windowed?.end}
          label={windowed ? "Events during your trip" : "Upcoming events"}
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
          <EventRow
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
