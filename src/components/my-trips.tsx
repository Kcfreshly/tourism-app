"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { activateTrip } from "./trip-store";
import type { Profile } from "@/domain/profile";
export default function MyTrips() {
  const [busy, setBusy] = useState(false);
  const [trips, setTrips] = useState<
      { id: string; version: number; profile: Profile }[]
    >([]),
    [status, setStatus] = useState("Loading your drafts…");
  useEffect(() => {
    fetch("/api/v1/trips")
      .then(async (r) => {
        if (r.status === 401) {
          setStatus("No drafts in this browser yet.");
          return;
        }
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        setTrips(body.data);
        setStatus(
          body.data.length
            ? "Saved securely for this browser session."
            : "No drafts yet.",
        );
      })
      .catch((e) => setStatus(e.message));
  }, []);
  return (
    <section>
      <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
      <h1>My trip drafts</h1>
      <p className="lede">
        Keep different ideas for dates, budgets and travel styles. Each draft
        has its own profile and itinerary.
      </p>
      <p role="status">{status}</p>
      <div className="experience-grid">
        {trips.map((t) => (
          <article className="card card-body" key={t.id}>
            <p className="eyebrow">DRAFT · VERSION {t.version}</p>
            <h2>{t.profile.draftName || "Your Lagos stay"}</h2>
            <p>
              {t.profile.startDate} – {t.profile.endDate} · {t.profile.adults}{" "}
              adults
            </p>
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
                href={`/trips/${t.id}/profile`}
              >
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
                      error instanceof Error ? error.message : "Please retry.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Create a draft from this profile
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="actions">
        <Link className="button secondary" href="/plan/new?fresh=1">
          Start a new trip
        </Link>
        <button
          className="secondary"
          onClick={async () => {
            const r = await fetch("/api/v1/session", { method: "DELETE" });
            if (r.ok) {
              setTrips([]);
              setStatus("Session ended. Private data cleared from this page.");
            } else setStatus("Unable to end session. Retry.");
          }}
        >
          End this browser session
        </button>
      </div>
      <p className="muted">
        Guest drafts use a private HttpOnly cookie. Sign in to link them to your
        demo account. Do not use real personal data.
      </p>
      <Link href="/account">Sign in / manage account →</Link>
    </section>
  );
}
