"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PlannerSplit from "./planner-split";
import PlannerTimeline from "./planner-timeline";
import PlannerActivityCard from "./planner-activity-card";
import type { PlannerDrag } from "@/domain/planner-interactions";
import type { Profile } from "@/domain/profile";
import {
  tripDays,
  minutes,
  time,
  type Item,
  type Services,
  assess,
  placementIssues,
  placementMessage,
  availableStarts,
} from "@/domain/planner";
import type { Experience } from "@/server/catalogue";
import { useBucket } from "./bucket";
import categories from "../../tourism-v1-handoff/data/categories.json";
type Price = ReturnType<typeof assess>;
type Trip = {
  id: string;
  version: number;
  profile: Profile;
  items: Item[];
  services: Services;
};
type Proposal = {
  id: string;
  expectedVersion: number;
  items: Item[];
  services: Services;
  assumptions: string[];
  questions: string[];
  price: Price;
  diff: { added: Item[]; removed: Item[] };
};
const money = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(n / 100);
async function api(path: string, method = "GET", payload?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error?.message ?? "Request failed. Retry.");
  return body.data;
}
export default function Planner({
  id,
  servicesOnly = false,
}: {
  id: string;
  servicesOnly?: boolean;
}) {
  const {
    ids: bucket,
    clear: clearBucket,
    restore: restoreBucket,
  } = useBucket();
  const [clearedBucket, setClearedBucket] = useState<string[] | null>(null);
  const [layoutReset, setLayoutReset] = useState(0);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const [replacing, setReplacing] = useState<Item | null>(null);
  const [view, setView] = useState("all");
  const [shuffle, setShuffle] = useState(0);
  const [dragging, setDragging] = useState<PlannerDrag | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null),
    [offers, setOffers] = useState<Experience[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [services, setServices] = useState<Services | null>(null),
    [price, setPrice] = useState<Price | null>(null),
    [day, setDay] = useState(""),
    [status, setStatus] = useState("Loading your plan…"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [blocked, setBlocked] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<Item | null>(null),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [past, setPast] = useState<{ items: Item[]; services: Services }[]>([]);
  const dialog = useRef<HTMLDialogElement>(null),
    library = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing && !dialog.current?.open) dialog.current?.showModal();
  }, [editing]);
  const root = `/api/v1/trips/${id}`;
  const receive = useCallback((data: { trip: Trip; price: Price }) => {
    setTrip(data.trip);
    setItems(data.trip.items);
    setServices(data.trip.services);
    setPrice(data.price);
    setDirty(false);
    setBlocked(false);
  }, []);
  useEffect(() => {
    let active = true;
    api(`${root}/workspace`)
      .then((data) => {
        if (!active) return;
        receive(data);
        setOffers(data.offers);
        setDay(data.trip.profile.startDate);
        setStatus("Saved. No capacity held.");
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, [root, receive]);
  const save = useCallback(async () => {
    if (!trip || !services) return false;
    setBusy(true);
    setStatus("Saving and recalculating…");
    try {
      const data = await api(`${root}/workspace`, "PUT", {
        expectedVersion: trip.version,
        items,
        services,
      });
      receive(data);
      setStatus("Saved. Estimate updated.");
      return true;
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Save failed; edits retained.",
      );
      setBlocked(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [trip, services, items, root, receive]);
  useEffect(() => {
    if (!dirty || busy || blocked) return;
    const timer = setTimeout(() => {
      void save();
    }, 900);
    return () => clearTimeout(timer);
  }, [dirty, busy, blocked, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(nextItems: Item[], nextServices = services) {
    if (!services || !nextServices || !trip || busy) return false;
    const issue = placementIssues(
      trip.profile,
      nextItems,
      nextServices,
      offers,
    )[0];
    if (issue) {
      setStatus(placementMessage(issue));
      return false;
    }
    setPast((p) => [
      ...p.slice(-19),
      { items: structuredClone(items), services: structuredClone(services) },
    ]);
    setItems(nextItems);
    setServices(nextServices);
    setDirty(true);
    setBlocked(false);
    setProposal(null);
    setStatus("Unsaved changes · recalculation pending");
    return true;
  }
  function openItem(item: Item) {
    setEditing(item);
  }
  function add(offer?: Experience) {
    library.current?.close();
    const scheduled = items.filter((i) => i.localDate === day);
    const last = Math.max(
      540,
      ...scheduled.map((i) => minutes(i.endTime) + 45),
    );
    const session =
      offer?.schedulingType === "FIXED"
        ? offer.sessions?.find((s) => !s.dates || s.dates.includes(day))
        : undefined;
    const start = session
      ? minutes(session.startTime)
      : offer
        ? Math.max(last, minutes(offer.availabilityLocal.opensAt))
        : last;
    const available =
      offer && trip && services
        ? availableStarts(
            trip.profile,
            offer,
            day,
            items,
            services,
            offers,
            replacing?.id,
          )
        : [];
    if (offer && !available.length) {
      setStatus(
        "This experience cannot fit this day: check opening hours, sessions, capacity, duration and travel buffers.",
      );
      return;
    }
    openItem({
      ...(available[0] ?? {}),
      id: replacing?.id ?? crypto.randomUUID(),
      localDate: day,
      startTime: available[0]?.startTime ?? time(Math.min(start, 1380)),
      endTime:
        available[0]?.endTime ??
        time(
          Math.min(
            start +
              (session?.durationMinutes ?? offer?.durationMinMinutes ?? 60),
            1439,
          ),
        ),
      kind: offer ? "EXPERIENCE" : "CUSTOM",
      offerId: offer?.offer.id ?? null,
      title: offer?.name.replace(/\s*[—-]\s*DEMO$/, "") ?? "Personal time",
      locked: false,
    });
  }
  async function generate() {
    if (dirty && !(await save())) return;
    setBusy(true);
    setStatus("Preparing a trip proposal…");
    try {
      setProposal(
        await api(`${root}/plan`, "POST", { selectedOfferIds: bucket }),
      );
      setStatus("Proposal ready. Review the changes before applying.");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Planner unavailable. Your saved plan is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const libraryEntries = offers
    .filter(
      (e) =>
        (view === "all" || bucket.includes(e.offer.id)) &&
        (!category || e.categoryId === category) &&
        e.name.toLowerCase().includes(search.toLowerCase()),
    )
    .map((e, index) => {
      const starts =
        trip && services
          ? availableStarts(
              trip.profile,
              e,
              day,
              items,
              services,
              offers,
              replacing?.id,
            )
          : [];
      if (!trip) return { e, starts, score: 0 };
      const cost =
        e.offer.rateMinor *
        (e.offer.priceBasis === "PER_ADULT" ? trip.profile.adults : 1);
      const budget =
        trip.profile.budgetMinor *
        (trip.profile.budgetBasis === "PERSON" ? trip.profile.adults : 1);
      const nearby =
        e.zoneId === trip.profile.zoneId ||
        items.some(
          (i) =>
            i.localDate === day &&
            offers.find((o) => o.offer.id === i.offerId)?.zoneId === e.zoneId,
        );
      const score =
        Number(starts.length > 0) * 100 +
        Number(nearby) * 4 +
        Number(
          trip.profile.interests.includes(
            e.categoryId as Profile["interests"][number],
          ),
        ) *
          4 +
        Number(!budget || cost <= budget) * 3 +
        Number(bucket.includes(e.offer.id)) * 2 +
        (shuffle
          ? (((index + shuffle) % offers.length) / offers.length) * 8
          : 0);
      return { e, starts, score };
    })
    .sort((a, b) => b.score - a.score);
  function candidateAt(
    payload: PlannerDrag,
    at: number,
    date = day,
  ): Item | null {
    const existing =
      payload.kind === "item"
        ? items.find((item) => item.id === payload.id)
        : undefined;
    if (existing?.locked) return null;
    const offer = offers.find(
      (e) =>
        e.offer.id ===
        (payload.kind === "offer" ? payload.offerId : existing?.offerId),
    );
    if (!existing && !offer) return null;
    const session =
      offer?.schedulingType === "FIXED"
        ? offer.sessions?.find(
            (session) =>
              minutes(session.startTime) === at &&
              (!session.dates || session.dates.includes(date)),
          )
        : undefined;
    if (offer?.schedulingType === "FIXED" && !session) return null;
    const duration =
      session?.durationMinutes ??
      (existing
        ? minutes(existing.endTime) - minutes(existing.startTime)
        : offer!.durationMinMinutes);
    if (at < 0 || at + duration >= 1440) return null;
    return {
      ...existing,
      id: payload.id,
      localDate: date,
      startTime: time(at),
      endTime: time(at + duration),
      kind: existing?.kind ?? "EXPERIENCE",
      offerId: offer?.offer.id ?? null,
      title: existing?.title ?? offer!.name.replace(/\s*[\u2014-]\s*DEMO$/, ""),
      locked: existing?.locked ?? false,
    };
  }
  function validateCandidate(candidate: Item) {
    if (!trip || !services) return "Your trip is loading.";
    const issue = placementIssues(
      trip.profile,
      [...items.filter((item) => item.id !== candidate.id), candidate],
      services,
      offers,
    )[0];
    return issue ? placementMessage(issue) : undefined;
  }
  function commitCandidate(candidate: Item) {
    if (!services) return false;
    let nextServices = services;
    if (
      candidate.kind === "EXPERIENCE" &&
      !services.vehicleWindows[candidate.localDate]
    )
      nextServices = {
        ...services,
        vehicleWindows: {
          ...services.vehicleWindows,
          [candidate.localDate]: { startTime: "08:00", hours: 8 },
        },
      };
    return change(
      [...items.filter((item) => item.id !== candidate.id), candidate],
      nextServices,
    );
  }
  const libraryContents = (
    <div className="library-shell compact-library">
      <div className="library-controls">
        <div className="library-tabs">
          <button
            aria-pressed={view === "bucket"}
            onClick={() => setView("bucket")}
          >
            My Bucket <span>{bucket.length}</span>
          </button>
          <button aria-pressed={view === "all"} onClick={() => setView("all")}>
            All Experiences
          </button>
          <button
            className="shuffle-button"
            title="Refresh suggestions without changing your itinerary"
            aria-label="Shuffle suggestions"
            onClick={() => {
              setView("all");
              setShuffle((n) => n + 1);
            }}
          >
            Shuffle
          </button>
        </div>
        <div className="library-filters">
          <label>
            <span className="sr-only">Search activities</span>
            <input
              aria-label="Search activities"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities"
            />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select
              aria-label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="library-utility">
          <span>Drag into your day, or select Add to day.</span>
          <details>
            <summary>Help</summary>
            <p>
              My Bucket is your saved shortlist. All Experiences is the full
              catalogue. Saving does not book or schedule an activity. Shuffle
              refreshes suggestions without changing your itinerary.
            </p>
          </details>
        </div>
        {view === "bucket" && (
          <div className="bucket-navigation">
            <Link href={`/explore?trip=${encodeURIComponent(id)}`}>
              Explore more experiences
            </Link>
            <button
              className="text-button"
              disabled={!bucket.length}
              onClick={() => clearDialog.current?.showModal()}
            >
              Clear bucket
            </button>
          </div>
        )}
        {clearedBucket && (
          <div className="bucket-undo" role="status">
            Bucket cleared.{" "}
            <button
              className="text-button"
              aria-label="Undo clear bucket"
              onClick={() => {
                restoreBucket(clearedBucket);
                setClearedBucket(null);
              }}
            >
              Undo
            </button>
          </div>
        )}
        {replacing && (
          <div className="replacement-hint">
            Choose an alternative to {replacing.title}.{" "}
            <button onClick={() => setReplacing(null)}>
              Cancel replacement
            </button>
          </div>
        )}
      </div>
      <div
        className="library-items activity-card-grid"
        role="region"
        aria-label="Scrollable experience list"
        tabIndex={0}
      >
        {!libraryEntries.length && (
          <div className="library-empty">
            <h3>
              {view === "bucket" && !bucket.length
                ? "Your bucket is empty."
                : "No matching experiences"}
            </h3>
            <p>
              {view === "bucket" && !bucket.length
                ? "Explore experiences to save your favourites."
                : "Try another category or search."}
            </p>
            <Link
              className="button"
              href={`/explore?trip=${encodeURIComponent(id)}`}
            >
              Explore experiences
            </Link>
          </div>
        )}
        {libraryEntries.map(({ e, starts }) => (
          <PlannerActivityCard
            key={e.offer.id}
            experience={e}
            saved={bucket.includes(e.offer.id)}
            busy={busy}
            available={!!starts.length}
            onAdd={() => add(e)}
            onDrag={setDragging}
          />
        ))}
      </div>
    </div>
  );
  if (!trip || !services)
    return (
      <section>
        <h1>Your plan</h1>
        <p role="status">{status}</p>
        <Link href="/trips">Return to my trips</Link>
      </section>
    );
  const days = tripDays(trip.profile),
    dayItems = items
      .filter((i) => i.localDate === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    hasActivities = dayItems.some((i) => i.kind === "EXPERIENCE");
  const serviceControls = (
    <>
      <h2>Your support</h2>
      <label>
        Assistance level
        <select
          disabled={busy}
          value={services.assistance}
          onChange={(e) =>
            change(items, {
              ...services,
              assistance: e.target.value as Services["assistance"],
            })
          }
        >
          <option value="DRIVER_ONLY">Driver only</option>
          <option value="ACTIVITY_GUIDE">Selected-activity guide</option>
          <option value="FULL_DAY_GUIDE">Full-day guide</option>
        </select>
      </label>
      <p className="muted">
        Dedicated vehicle for each experience day. No 24-hour hosting. Personal
        blocks are unsupervised.
      </p>
      {hasActivities ? (
        <>
          <h3>{day} · dedicated vehicle</h3>
          <div className="field-grid">
            <label>
              Pickup / coverage start
              <input
                disabled={busy}
                type="time"
                value={services.vehicleWindows[day]?.startTime ?? "08:00"}
                onChange={(e) =>
                  change(items, {
                    ...services,
                    vehicleWindows: {
                      ...services.vehicleWindows,
                      [day]: {
                        startTime: e.target.value,
                        hours: services.vehicleWindows[day]?.hours ?? 8,
                      },
                    },
                  })
                }
              />
            </label>
            <label>
              Reserved hours
              <select
                disabled={busy}
                value={services.vehicleWindows[day]?.hours ?? ""}
                onChange={(e) =>
                  change(items, {
                    ...services,
                    vehicleWindows: {
                      ...services.vehicleWindows,
                      [day]: {
                        startTime:
                          services.vehicleWindows[day]?.startTime ?? "08:00",
                        hours: Number(e.target.value) as 4 | 8,
                      },
                    },
                  })
                }
              >
                <option value="" disabled>
                  Select a block
                </option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Coverage includes gaps, pickup and return. Over 8 hours is
            unavailable. Fictional travel buffers apply.
          </p>
          {services.assistance === "FULL_DAY_GUIDE" && (
            <label className="check">
              <input
                disabled={busy}
                type="checkbox"
                checked={services.guideDays.includes(day)}
                onChange={(e) =>
                  change(items, {
                    ...services,
                    guideDays: e.target.checked
                      ? [...services.guideDays, day]
                      : services.guideDays.filter((d) => d !== day),
                  })
                }
              />
              8-hour guide from vehicle coverage start
            </label>
          )}
          {services.assistance === "ACTIVITY_GUIDE" &&
            dayItems
              .filter((i) => i.kind === "EXPERIENCE")
              .map((i) => {
                const included = offers.find((e) => e.offer.id === i.offerId)
                  ?.offer.hostIncluded;
                return (
                  <label key={i.id} className="check">
                    <input
                      type="checkbox"
                      disabled={busy || included}
                      checked={included || services.guideItemIds.includes(i.id)}
                      onChange={(e) =>
                        change(items, {
                          ...services,
                          guideItemIds: e.target.checked
                            ? [...services.guideItemIds, i.id]
                            : services.guideItemIds.filter((id) => id !== i.id),
                        })
                      }
                    />
                    {i.title}
                    {included ? " · host included" : ""}
                  </label>
                );
              })}
        </>
      ) : (
        <p>No vehicle bought for a day with only personal/free time.</p>
      )}
      <hr />
      <h3>Arrival extras</h3>
      <p className="muted">
        Airport transfers and arrival extras are not available yet.
      </p>
    </>
  );
  const editingOffer = offers.find(
    (offer) => offer.offer.id === editing?.offerId,
  );
  const editingSessions =
    editing && editingOffer?.schedulingType === "FIXED"
      ? availableStarts(
          trip.profile,
          editingOffer,
          editing.localDate,
          items,
          services,
          offers,
          editing.id,
        )
      : [];
  const scheduleContents = (
    <PlannerTimeline
      day={day}
      items={dayItems}
      offers={offers}
      busy={busy}
      dragging={dragging}
      onDrag={setDragging}
      candidateAt={candidateAt}
      validate={validateCandidate}
      onCommit={commitCandidate}
      onMessage={setStatus}
      onPersonal={() => add()}
      onEdit={(item) => {
        setReplacing(null);
        openItem(item);
      }}
      onRemove={(item) => change(items.filter((i) => i.id !== item.id))}
      onLock={(item) =>
        change(
          items.map((i) =>
            i.id === item.id ? { ...i, locked: !i.locked } : i,
          ),
        )
      }
      onReplace={(item) => {
        setReplacing(item);
        setView("all");
        library.current?.showModal();
      }}
    />
  );
  return (
    <section className="planner-page planner-refined">
      <div className="planner-heading">
        <div>
          <h1>{trip.profile.draftName || "Your Lagos trip"}</h1>
          <p>
            {trip.profile.adults} adults / {days.length} days /{" "}
            {trip.profile.accommodation || "Starting area not set"}
          </p>
        </div>
        <Link href={`/trips/${id}/profile`}>Edit trip profile</Link>
      </div>
      <div className="workspace-toolbar">
        <div className="workspace-actions">
          <button
            className="secondary"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            Save
          </button>
          <button
            className="secondary"
            disabled={busy || !past.length}
            onClick={() => {
              const previous = past.at(-1)!;
              setPast((p) => p.slice(0, -1));
              setItems(previous.items);
              setServices(previous.services);
              setDirty(true);
              setBlocked(false);
              setProposal(null);
              setStatus("Undo restored. Saving...");
            }}
          >
            Undo
          </button>
          <button
            className="secondary"
            disabled={busy || dirty}
            onClick={generate}
          >
            Suggest a plan
          </button>
          {!servicesOnly && (
            <button
              className="text-button reset-layout"
              onClick={() => setLayoutReset((n) => n + 1)}
            >
              Reset layout
            </button>
          )}
        </div>
        <div className="compact-price">
          <details className="price-popover">
            <summary>
              <span>Estimated total</span>
              <strong aria-busy={dirty}>
                {money(price?.totalMinor ?? 0)}
                {dirty ? " *" : ""}
              </strong>
              <span aria-hidden="true">&#8964;</span>
            </summary>
            <div className="price-popover-content">
              <h2>Cost details</h2>
              {price && price.totalMinor > 0 ? (
                <dl className="price-lines">
                  <dt>Activities</dt>
                  <dd>{money(price.activitiesMinor)}</dd>
                  <dt>Transport</dt>
                  <dd>{money(price.transportMinor)}</dd>
                  <dt>Hosting</dt>
                  <dd>{money(price.hostingMinor)}</dd>
                  <dt>Service fee</dt>
                  <dd>{money(price.feeMinor)}</dd>
                  <dt>Tax</dt>
                  <dd>{money(price.taxMinor)}</dd>
                  <dt>Total</dt>
                  <dd>
                    <strong>{money(price.totalMinor)}</strong>
                  </dd>
                </dl>
              ) : (
                <p>Add activities to see your estimate.</p>
              )}
              <p>
                Checkout is not available yet. Saving a plan does not make a
                booking.
              </p>
              <button disabled>Checkout unavailable</button>
            </div>
          </details>
          <Link
            className="button"
            href={`/trips/${id}/${servicesOnly ? "plan" : "services"}`}
          >
            {servicesOnly ? "Back to planner" : "Review services"}
          </Link>
        </div>
      </div>
      <div className="planner-save-state" role="status" aria-live="polite">
        {status}
      </div>
      {blocked && (
        <div className="field-error">
          Your latest changes could not be saved. They remain here.{" "}
          <button className="text-button" onClick={() => void save()}>
            Retry save
          </button>
          <button
            className="text-button"
            onClick={async () => {
              if (
                !window.confirm(
                  "Discard unsaved changes and reload the saved plan?",
                )
              )
                return;
              try {
                const data = await api(`${root}/workspace`);
                receive(data);
                setOffers(data.offers);
                setPast([]);
                setProposal(null);
              } catch (error) {
                setStatus(
                  error instanceof Error ? error.message : "Please retry.",
                );
              }
            }}
          >
            Reload saved plan
          </button>
        </div>
      )}
      <div className="day-chips compact-days" aria-label="Trip days">
        {days.map((date, index) => (
          <button
            key={date}
            aria-pressed={date === day}
            className={date === day ? "" : "secondary"}
            onClick={() => setDay(date)}
            disabled={busy}
            onDragOver={(event) => {
              if (dragging) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging?.kind === "item") {
                const existing = items.find((item) => item.id === dragging.id);
                if (existing) {
                  const candidate = candidateAt(
                    dragging,
                    minutes(existing.startTime),
                    date,
                  );
                  if (candidate) commitCandidate(candidate);
                  else
                    setStatus("Choose a valid alternative session using Edit.");
                }
              }
              setDragging(null);
            }}
          >
            Day {index + 1}
            <span>
              {new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
            {items.some(
              (item) =>
                item.localDate === date &&
                offers.find((e) => e.offer.id === item.offerId)?.kind ===
                  "FULL_DAY",
            ) && <b>Full</b>}
          </button>
        ))}
      </div>
      {servicesOnly ? (
        <div className="services-workspace card card-body">
          {serviceControls}
        </div>
      ) : (
        <PlannerSplit
          resetKey={layoutReset}
          library={libraryContents}
          schedule={scheduleContents}
        />
      )}
      {price && (price.blockers.length > 0 || price.warnings.length > 0) && (
        <details className="planner-validation">
          <summary>
            {price.blockers.length
              ? `${price.blockers.length} ${price.blockers.length === 1 ? "thing" : "things"} to review before booking`
              : "Plan advice"}
          </summary>
          {[...price.blockers, ...price.warnings].map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
        </details>
      )}
      <dialog
        ref={clearDialog}
        className="clear-bucket-dialog"
        aria-label="Clear your bucket"
      >
        <h2>Clear your bucket?</h2>
        <p>
          This removes your saved activities. Activities already scheduled in
          your trip will stay.
        </p>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => clearDialog.current?.close()}
          >
            Keep activities
          </button>
          <button
            onClick={() => {
              setClearedBucket(clearBucket());
              clearDialog.current?.close();
            }}
          >
            Clear bucket
          </button>
        </div>
      </dialog>
      {proposal && (
        <div className="card proposal card-body">
          <p className="eyebrow">PROPOSAL ONLY · CURRENT PLAN UNCHANGED</p>
          <h2>Review the proposed changes.</h2>
          <p>
            {proposal.diff.removed.length} removed ·{" "}
            {proposal.diff.added.length} added · locked items retained ·{" "}
            {money(proposal.price.totalMinor)} estimated total (change:{" "}
            {money(proposal.price.totalMinor - (price?.totalMinor ?? 0))})
          </p>
          {proposal.questions.map((question) => (
            <p key={question}>{question}</p>
          ))}
          <div className="proposal-diff">
            <div>
              <h3>Remove</h3>
              {proposal.diff.removed.map((i) => (
                <p key={i.id}>
                  {i.localDate} {i.startTime} · {i.title}
                </p>
              ))}
            </div>
            <div>
              <h3>Add</h3>
              {proposal.diff.added.map((i) => (
                <p key={i.id}>
                  {i.localDate} {i.startTime}–{i.endTime} · {i.title}
                  <br />
                </p>
              ))}
            </div>
          </div>
          {proposal.price.blockers.map((b, index) => (
            <p className="field-error" key={index}>
              {b.message}
            </p>
          ))}
          <div className="actions">
            <button
              disabled={
                busy || dirty || trip.version !== proposal.expectedVersion
              }
              onClick={async () => {
                setBusy(true);
                try {
                  const data = await api(`${root}/plan/apply`, "POST", {
                    proposalId: proposal.id,
                    expectedVersion: proposal.expectedVersion,
                  });
                  setPast((p) => [...p.slice(-19), { items, services }]);
                  receive(data);
                  setProposal(null);
                  setStatus("Proposal applied and saved. No booking made.");
                } catch (e) {
                  setStatus(
                    e instanceof Error
                      ? e.message
                      : "Apply failed; existing plan retained.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Apply this proposal
            </button>
            <button className="secondary" onClick={() => setProposal(null)}>
              Keep my current plan
            </button>
          </div>
        </div>
      )}
      <dialog ref={library} className="library-sheet">
        <button className="secondary" onClick={() => library.current?.close()}>
          Close experience library
        </button>
        {libraryContents}
      </dialog>
      <dialog
        ref={dialog}
        className="edit-dialog"
        onCancel={() => setEditing(null)}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const exists = items.some((i) => i.id === editing.id);
              let nextServices = services;
              if (
                editing.kind === "EXPERIENCE" &&
                !services.vehicleWindows[editing.localDate]
              )
                nextServices = {
                  ...services,
                  vehicleWindows: {
                    ...services.vehicleWindows,
                    [editing.localDate]: { startTime: "08:00", hours: 8 },
                  },
                };
              const accepted = change(
                exists
                  ? items.map((i) => (i.id === editing.id ? editing : i))
                  : [...items, editing],
                nextServices,
              );
              if (accepted) {
                dialog.current?.close();
                setEditing(null);
                setReplacing(null);
              }
            }}
          >
            <h2>
              {items.some((i) => i.id === editing.id)
                ? "Edit / move block"
                : "Add to your day"}
            </h2>
            {replacing && (
              <div className="notice">
                <h3>Confirm replacement</h3>
                <p>
                  {replacing.title}: {replacing.startTime}-{replacing.endTime}{" "}
                  becomes {editing.title}: {editing.startTime}-{editing.endTime}
                  .
                </p>
                <p>
                  Activity price change:{" "}
                  {money(
                    (offers.find((e) => e.offer.id === editing.offerId)?.offer
                      .rateMinor ?? 0) *
                      (offers.find((e) => e.offer.id === editing.offerId)?.offer
                        .priceBasis === "PER_ADULT"
                        ? trip.profile.adults
                        : 1) -
                      (offers.find((e) => e.offer.id === replacing.offerId)
                        ?.offer.rateMinor ?? 0) *
                        (offers.find((e) => e.offer.id === replacing.offerId)
                          ?.offer.priceBasis === "PER_ADULT"
                          ? trip.profile.adults
                          : 1),
                  )}
                  . Estimated total:{" "}
                  {money(
                    assess(
                      trip.profile,
                      items.map((i) => (i.id === replacing.id ? editing : i)),
                      services,
                      offers,
                    ).totalMinor,
                  )}
                  .
                </p>
              </div>
            )}
            <label>
              Title
              <input
                required
                maxLength={160}
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label>
              Day
              <select
                value={editing.localDate}
                onChange={(e) =>
                  setEditing({ ...editing, localDate: e.target.value })
                }
              >
                {days.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            {offers.find((e) => e.offer.id === editing.offerId)
              ?.schedulingType === "FIXED" && (
              <label>
                Available sessions
                <select
                  value={editing.startTime}
                  onChange={(event) => {
                    const session = offers
                      .find((e) => e.offer.id === editing.offerId)
                      ?.sessions?.find(
                        (s) => s.startTime === event.target.value,
                      );
                    if (session)
                      setEditing({
                        ...editing,
                        startTime: session.startTime,
                        endTime: time(
                          minutes(session.startTime) + session.durationMinutes,
                        ),
                      });
                  }}
                >
                  <option value="" disabled>
                    Choose a session
                  </option>
                  {offers
                    .find((e) => e.offer.id === editing.offerId)
                    ?.sessions?.filter((s) =>
                      editingSessions.some(
                        (candidate) =>
                          candidate.startTime === s.startTime &&
                          minutes(candidate.endTime) -
                            minutes(candidate.startTime) ===
                            s.durationMinutes,
                      ),
                    )
                    .map((s) => (
                      <option key={s.startTime} value={s.startTime}>
                        {s.startTime} - {s.durationMinutes} minutes
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="field-grid">
              <label>
                Start (Africa/Lagos)
                <input
                  required
                  type="time"
                  disabled={
                    offers.find((e) => e.offer.id === editing.offerId)
                      ?.schedulingType === "FIXED"
                  }
                  value={editing.startTime}
                  onChange={(e) =>
                    setEditing({ ...editing, startTime: e.target.value })
                  }
                />
              </label>
              <label>
                End (Africa/Lagos)
                <input
                  required
                  type="time"
                  disabled={
                    offers.find((e) => e.offer.id === editing.offerId)
                      ?.schedulingType === "FIXED"
                  }
                  value={editing.endTime}
                  onChange={(e) =>
                    setEditing({ ...editing, endTime: e.target.value })
                  }
                />
              </label>
            </div>
            {editing.kind === "EXPERIENCE" && (
              <p className="muted">
                Offer duration:{" "}
                {
                  offers.find((e) => e.offer.id === editing.offerId)
                    ?.durationMinMinutes
                }
                –
                {
                  offers.find((e) => e.offer.id === editing.offerId)
                    ?.durationMaxMinutes
                }{" "}
                min. Invalid placements are rejected; choose a valid time or
                session.
              </p>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={editing.locked}
                onChange={(e) =>
                  setEditing({ ...editing, locked: e.target.checked })
                }
              />
              Keep this block when generating a proposal
            </label>
            <p role="status">{status}</p>
            <div className="actions">
              <button type="submit">
                {replacing ? "Confirm replacement" : "Save block"}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  dialog.current?.close();
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
