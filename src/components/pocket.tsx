"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experience } from "@/server/catalogue";
import type { Profile } from "@/domain/profile";
import { minutes, tripDays, type Item, type Services } from "@/domain/planner";
import { displayName, zoneLabel } from "@/domain/experience-content";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";

type Trip = {
  id: string;
  profile: Profile;
  items: Item[];
  services: Services;
};
function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(
    new Date(),
  );
}
function gapLabel(total: number) {
  const h = Math.floor(total / 60),
    m = total % 60;
  return h ? `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min` : ""}` : `${m} min`;
}
function dayTitle(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// Lightweight read-only companion: the planned day at a glance. It shows only
// what the itinerary contains; assignments and support appear once booked.
export default function Pocket({ id }: { id: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [offers, setOffers] = useState<Experience[]>([]);
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/v1/trips/${id}/workspace`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.message ?? "Unable to load trip.");
        const days = tripDays(body.data.trip.profile);
        setTrip(body.data.trip);
        setOffers(body.data.offers);
        setDay(days.includes(lagosToday()) ? lagosToday() : days[0]);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  if (!trip)
    return (
      <section className="pocket">
        <div className="page-status">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Link className="text-link" href="/trips">
                Back to my trips
              </Link>
            </>
          ) : (
            <>
              <div className="spinner" aria-hidden="true" />
              <p role="status">Loading your day…</p>
            </>
          )}
        </div>
      </section>
    );
  const days = tripDays(trip.profile);
  const isToday = day === lagosToday();
  const now = isToday
    ? (() => {
        const [h, m] = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lagos",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date())
          .split(":")
          .map(Number);
        return h * 60 + m;
      })()
    : -1;
  const dayItems = trip.items
    .filter((item) => item.localDate === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const next =
    dayItems.find((item) => minutes(item.endTime) > now) ?? dayItems[0];
  const nextOffer = offers.find((o) => o.offer.id === next?.offerId);
  const vehicle = trip.services.vehicleWindows[day];
  const index = days.indexOf(day);
  return (
    <section className="pocket">
      <header className="pocket-top">
        <Link
          className="icon-button"
          href={`/trips/${id}/plan`}
          aria-label="Back to planner"
        >
          <Icon name="chevronLeft" size={22} />
        </Link>
        <div>
          <p className="eyebrow">
            Day {index + 1} of {days.length}
          </p>
          <h1>{dayTitle(day)}</h1>
        </div>
        <div className="pocket-step">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous day"
            disabled={index <= 0}
            onClick={() => setDay(days[index - 1])}
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next day"
            disabled={index >= days.length - 1}
            onClick={() => setDay(days[index + 1])}
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
      </header>
      <p className="pocket-notice">
        <Icon name="info" size={16} />
        This is your planned day. Nothing is booked yet, so driver and guide
        details aren’t assigned.
      </p>
      {next ? (
        <article className="next-up" aria-label="Next up">
          <p className="eyebrow">{isToday ? "Next up" : "First up"}</p>
          <p className="next-time">
            {next.startTime}
            <span>until {next.endTime}</span>
          </p>
          <h2>{displayName(next.title)}</h2>
          <ul className="trip-facts">
            {nextOffer && (
              <li>
                <Icon name="pin" size={15} />
                {zoneLabel(nextOffer.zoneId)}, Lagos
              </li>
            )}
            {nextOffer && vehicle && (
              <li>
                <Icon name="car" size={15} />
                Vehicle planned from {vehicle.startTime}
              </li>
            )}
            {nextOffer?.offer.hostIncluded && (
              <li>
                <Icon name="users" size={15} />
                Local host included
              </li>
            )}
          </ul>
          {nextOffer && (
            <ExperienceOverlay
              experience={nextOffer}
              trigger={
                <>
                  What to expect <Icon name="arrowRight" size={16} />
                </>
              }
            />
          )}
        </article>
      ) : (
        <div className="empty-state">
          <Icon name="sun" size={28} />
          <h2>A free day</h2>
          <p>
            Nothing is planned. Rest, wander, or add something in the planner.
          </p>
          <Link className="button secondary" href={`/trips/${id}/plan`}>
            Open planner
          </Link>
        </div>
      )}
      {dayItems.length > 0 && (
        <section aria-labelledby="pocket-timeline">
          <h2 id="pocket-timeline" className="pocket-section-title">
            The day
          </h2>
          <ol className="pocket-timeline">
            {dayItems.map((item, i) => {
              const offer = offers.find((o) => o.offer.id === item.offerId);
              const gap =
                i > 0
                  ? minutes(item.startTime) - minutes(dayItems[i - 1].endTime)
                  : 0;
              const done = isToday && minutes(item.endTime) <= now;
              return (
                <li
                  key={item.id}
                  data-kind={
                    item.kind === "EXPERIENCE" ? "activity" : "personal"
                  }
                  data-done={done}
                  data-current={item.id === next?.id}
                >
                  {gap >= 30 && (
                    <p className="pocket-gap">Free time · {gapLabel(gap)}</p>
                  )}
                  <div className="pocket-item">
                    <time>{item.startTime}</time>
                    <div>
                      <strong>
                        {offer ? (
                          <ExperienceOverlay
                            experience={offer}
                            trigger={displayName(item.title)}
                            triggerStyle="title"
                          />
                        ) : (
                          item.title
                        )}
                      </strong>
                      <span>
                        {item.startTime}–{item.endTime}
                        {offer
                          ? ` · ${zoneLabel(offer.zoneId)}${offer.schedulingType === "FIXED" ? " · Set session" : ""}`
                          : " · Personal time"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <section id="help" className="pocket-help" aria-labelledby="pocket-help">
        <h2 id="pocket-help" className="pocket-section-title">
          Help
        </h2>
        <p>
          Once your trip is booked, you’ll be able to reach trip support and see
          your driver and guide here.
        </p>
        <p className="muted">
          For immediate danger, contact local emergency services.
        </p>
      </section>
      <nav className="pocket-nav" aria-label="Trip">
        <a href="#main" aria-current="page">
          <Icon name="sun" size={20} />
          Today
        </a>
        <Link href={`/trips/${id}/plan`}>
          <Icon name="calendar" size={20} />
          Plan
        </Link>
        <Link href="/trips">
          <Icon name="list" size={20} />
          Trips
        </Link>
        <a href="#help">
          <Icon name="help" size={20} />
          Help
        </a>
      </nav>
    </section>
  );
}
