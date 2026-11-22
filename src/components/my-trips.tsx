"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { activateTrip, forgetTrip } from "@/hooks/use-active-trip";
import { useBackdropDismiss } from "@/hooks/use-backdrop-dismiss";
import { useSignOut } from "@/hooks/use-sign-out";
import Icon from "./icons";
import type { Profile } from "@/modules/trips/domain/profile";
import {
  pickupReminder,
  type Item,
  type Services,
} from "@/modules/trips/domain/planner";
import { defaultTransportSettings } from "@/modules/trips/domain/transport-settings";
import { photoForCategory } from "@/modules/catalogue/domain/photos";
import { zoneLabel } from "@/modules/catalogue/domain/experience-content";

type Trip = {
  id: string;
  version: number;
  profile: Profile;
  items?: Item[];
  services?: Services;
};
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
export default function MyTrips({ saved }: { saved?: string }) {
  const router = useRouter();
  const { signOut, signingOut } = useSignOut();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]),
    [status, setStatus] = useState("");
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const dismissConfirm = useBackdropDismiss(confirmDialog);
  const [doomed, setDoomed] = useState<Trip | null>(null),
    [deleteError, setDeleteError] = useState("");
  function askToDelete(trip: Trip) {
    setDoomed(trip);
    setDeleteError("");
    confirmDialog.current?.showModal();
  }
  async function deletePlan() {
    if (!doomed) return;
    setBusy(true);
    setDeleteError("");
    try {
      const response = await fetch(
        `/api/v1/trips/${encodeURIComponent(doomed.id)}`,
        { method: "DELETE" },
      );
      // Already gone counts as deleted.
      if (!response.ok && response.status !== 404) {
        const body = await response.json();
        throw Error(body.error?.message);
      }
      forgetTrip(doomed.id);
      setTrips((previous) => previous.filter((t) => t.id !== doomed.id));
      setStatus(
        `“${doomed.profile.draftName || "Your Lagos stay"}” was deleted.`,
      );
      confirmDialog.current?.close();
    } catch (error) {
      setDeleteError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn’t delete this plan. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    fetch("/api/v1/trips")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/account?next=%2Ftrips");
          return;
        }
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        setTrips(body.data);
      })
      .catch((e) => setStatus(e.message))
      .finally(() => setLoading(false));
  }, [router]);
  useEffect(() => {
    // Bring the draft that was just saved into view.
    if (!loading && saved)
      document
        .getElementById(`trip-${saved}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [loading, saved]);
  const justSaved = trips.find((t) => t.id === saved);
  return (
    <section className="trips-page">
      <div className="page-header-row">
        <div className="page-intro">
          <p className="eyebrow">My plans</p>
          <h1>Pick up where you left off</h1>
          <p className="lede">
            Plans are day-by-day drafts you shape before booking. Keep separate
            plans for different dates or travel styles. Things you’ve chosen to
            buy are in your <Link href="/cart">cart</Link>.
          </p>
        </div>
        <Link className="button" href="/plan/new?fresh=1">
          <Icon name="plus" size={18} />
          Start a new plan
        </Link>
      </div>
      {justSaved && (
        <div className="saved-draft-banner" role="status">
          <span className="saved-mark" aria-hidden="true">
            <Icon name="check" size={22} />
          </span>
          <div>
            <p className="eyebrow">Draft saved</p>
            <h2>{justSaved.profile.draftName || "Your Lagos stay"}</h2>
            <p>
              It&#8217;s highlighted below. Open the planner when you&#8217;re
              ready, or keep exploring to add ideas to your bucket.
            </p>
          </div>
        </div>
      )}
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
            // The list has no staff settings; the default notice is close
            // enough for a reminder, and the planner shows the exact time.
            const needsPickup =
              !!t.services &&
              !!pickupReminder(
                t.profile,
                items,
                t.services,
                defaultTransportSettings,
              );
            return (
              <article
                className="card trip-card"
                key={t.id}
                id={`trip-${t.id}`}
                data-just-saved={t.id === saved || undefined}
              >
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
                    {needsPickup && (
                      <li className="pickup-flag">
                        <Icon name="pin" size={15} />
                        <Link href={`/trips/${t.id}/profile#accommodation`}>
                          Add your pickup address
                        </Link>
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
                          setTrips((previous) => [body.data, ...previous]);
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
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => askToDelete(t)}
                    >
                      Delete plan
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <dialog
        ref={confirmDialog}
        className="sheet-dialog delete-plan-dialog"
        aria-labelledby="delete-plan-title"
        {...dismissConfirm}
      >
        <div className="sheet-header">
          <div>
            <p className="eyebrow">Delete plan</p>
            <h2 id="delete-plan-title">
              Delete {doomed?.profile.draftName || "Your Lagos stay"}?
            </h2>
          </div>
          <button
            type="button"
            className="icon-button close-button"
            onClick={() => confirmDialog.current?.close()}
          >
            <Icon name="close" size={20} />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="sheet-body">
          <p className="muted">
            Its days and activities are removed for good. Your bucket and
            anything already in your cart stay as they are.
          </p>
          {deleteError && <p role="alert">{deleteError}</p>}
        </div>
        <div className="sheet-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => confirmDialog.current?.close()}
          >
            Keep plan
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={deletePlan}
          >
            {busy ? "Deleting…" : "Delete plan"}
          </button>
        </div>
      </dialog>
      <div className="trips-footer">
        <p>
          Drafts are saved privately to your account. Nothing is booked or
          charged.
        </p>
        <div className="actions">
          <Link className="text-link" href="/explore">
            Explore experiences
          </Link>
          <Link className="text-link" href="/account">
            Manage account
          </Link>
          <button
            className="text-button"
            disabled={signingOut}
            onClick={async () => {
              if (!(await signOut())) {
                setStatus("Unable to sign out. Retry.");
                return;
              }
              setTrips([]);
              router.replace("/");
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
