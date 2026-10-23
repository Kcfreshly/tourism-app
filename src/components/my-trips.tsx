"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { activateTrip } from "./trip-store";
import Icon from "./icons";
import type { Profile } from "@/domain/profile";
import type { Item } from "@/domain/planner";
import { photoForCategory } from "@/domain/photos";
import { zoneLabel } from "@/domain/experience-content";

type Trip = { id: string; version: number; profile: Profile; items?: Item[] };
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function dayCount(profile: Profile) {
  return (
    Math.round(
      (Date.parse(profile.endDate) - Date.parse(profile.startDate)) / 86400000,
    ) + 1
  );
}
export default function MyTrips() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]),
    [status, setStatus] = useState("");
  useEffect(() => {
    fetch("/api/v1/trips")
      .then(async (r) => {
        if (r.status === 401) return;
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        setTrips(body.data);
      })
      .catch((e) => setStatus(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="trips-page">
      <div className="page-header-row">
        <div className="page-intro">
          <p className="eyebrow">My trips</p>
          <h1>Pick up where you left off</h1>
          <p className="lede">
            Keep separate drafts for different dates, budgets or travel styles.
            Each has its own profile and itinerary.
          </p>
        </div>
        <Link className="button" href="/plan/new?fresh=1">
          <Icon name="plus" size={18} />
          Start a new trip
        </Link>
      </div>
      <p role="status" className="muted">
        {status}
      </p>
      {loading ? (
        <div className="page-status">
          <div className="spinner" aria-hidden="true" />
          <p>Loading your trips…</p>
        </div>
      ) : !trips.length ? (
        <div className="empty-state">
          <Icon name="calendar" size={28} />
          <h2>No trips yet</h2>
          <p>
            Start with Kemi or explore experiences first — your bucket comes
            with you either way.
          </p>
          <div className="actions">
            <Link className="button" href="/plan/new?mode=chat">
              Plan with Kemi
            </Link>
            <Link className="button secondary" href="/explore">
              Explore experiences
            </Link>
          </div>
        </div>
      ) : (
        <div className="trip-list">
          {trips.map((t) => {
            const items = t.items ?? [];
            const activities = items.filter(
              (i) => i.kind === "EXPERIENCE",
            ).length;
            const cover = photoForCategory(t.profile.interests[0] ?? "nature");
            return (
              <article className="card trip-card" key={t.id}>
                <div className="trip-card-cover">
                  <img src={cover.src} alt="" loading="lazy" />
                  <span className="status-badge">Draft · not booked</span>
                </div>
                <div className="trip-card-body">
                  <h2>{t.profile.draftName || "Your Lagos stay"}</h2>
                  <ul className="trip-facts">
                    <li>
                      <Icon name="calendar" size={15} />
                      {shortDate(t.profile.startDate)} –{" "}
                      {shortDate(t.profile.endDate)} · {dayCount(t.profile)}{" "}
                      days
                    </li>
                    <li>
                      <Icon name="users" size={15} />
                      {t.profile.adults} adults
                    </li>
                    {t.profile.zoneId !== "UNDECIDED" && (
                      <li>
                        <Icon name="pin" size={15} />
                        {zoneLabel(t.profile.zoneId)}
                      </li>
                    )}
                    <li>
                      <Icon name="list" size={15} />
                      {activities
                        ? `${activities} ${activities === 1 ? "activity" : "activities"} planned`
                        : "Nothing scheduled yet"}
                    </li>
                  </ul>
                  <div className="draft-actions">
                    <Link
                      className="button"
                      href={`/trips/${t.id}/plan`}
                      onClick={() => activateTrip(t.id)}
                    >
                      Open planner
                    </Link>
                    <Link
                      className="button secondary"
                      href={`/trips/${t.id}/today`}
                    >
                      Day view
                    </Link>
                    <Link className="text-link" href={`/trips/${t.id}/profile`}>
                      Review profile
                    </Link>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const response = await fetch("/api/v1/trips", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ...t.profile,
                              draftName:
                                `${t.profile.draftName || "Lagos trip"} - copy`.slice(
                                  0,
                                  80,
                                ),
                            }),
                          });
                          const body = await response.json();
                          if (!response.ok) throw Error(body.error.message);
                          setTrips((previous) => [...previous, body.data]);
                          setStatus(
                            "New draft created from this profile. Its itinerary starts empty; the original is unchanged.",
                          );
                        } catch (error) {
                          setStatus(
                            error instanceof Error
                              ? error.message
                              : "Please retry.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Duplicate profile
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="trips-footer">
        <p>
          Trips are saved privately to this browser. Sign in to keep them with
          your account.
        </p>
        <div className="actions">
          <Link className="text-link" href="/account">
            Sign in or manage account
          </Link>
          <button
            className="text-button"
            onClick={async () => {
              const r = await fetch("/api/v1/session", { method: "DELETE" });
              if (r.ok) {
                setTrips([]);
                setStatus(
                  "Session ended. Private data cleared from this page.",
                );
              } else setStatus("Unable to end session. Retry.");
            }}
          >
            End this browser session
          </button>
        </div>
      </div>
    </section>
  );
}
