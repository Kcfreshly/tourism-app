"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PlannerSplit from "./planner-split";
import PlannerTimeline from "./planner-timeline";
import PlannerActivityCard from "./planner-activity-card";
import type { PlannerDrag } from "@/modules/trips/domain/planner-interactions";
import type { Profile } from "@/modules/trips/domain/profile";
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
  assistanceFor,
  pastBookingCutoff,
  guideTooLate,
  dayTransport,
  nightGroup,
  fitCar,
  carCovers,
} from "@/modules/trips/domain/planner";
import {
  defaultTransportSettings,
  longestDayBlock,
  type TransportSettings,
} from "@/modules/trips/domain/transport-settings";
import type { Experience } from "@/modules/catalogue/domain/experience";
import { clockLabel, shortestVisit } from "@/modules/catalogue/domain/schedule";
import { ClearBucket } from "./bucket";
import { useBucket } from "@/hooks/use-bucket";
import Icon from "./icons";
import { useBackdropDismiss } from "@/hooks/use-backdrop-dismiss";
import {
  displayName,
  formatDuration,
  formatMoney,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import {
  eventDates,
  eventDay,
  eventWhen,
  isEvent,
  lagosToday,
} from "@/modules/catalogue/domain/events";
import categories from "../../tourism-v1-handoff/data/categories.json";
import rules from "../../tourism-v1-handoff/data/pricing.demo.json";
import TripCost from "./trip-cost";
import CheckoutButton from "./checkout-prompt";
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
const money = (n: number) => formatMoney(n, n % 100 ? 2 : 0);
// A time typed into a 24-hour input keeps the side of midnight the field was
// already on: an end of 27:00 edited to 04:00 becomes 28:00.
const sameSide = (current: string, typed: string) =>
  time((minutes(current) >= 1440 ? 1440 : 0) + minutes(typed));
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
// Validation messages from the domain lead with an ISO date; show the trip day.
function friendlyIssue(message: string, days: string[]) {
  return message.replace(/^(\d{4}-\d{2}-\d{2}):\s*/, (_, date: string) =>
    days.includes(date)
      ? `Day ${days.indexOf(date) + 1} (${shortDate(date)}): `
      : `${shortDate(date)}: `,
  );
}
const driverCodes = new Set([
  "MISSING_WINDOW",
  "SERVICE_WINDOW",
  "LATE_RETURN",
  "NIGHT_UNUSED",
  "GUIDE_NOTICE",
  "GUIDE_WINDOW",
  "ROUTE_UNSUPPORTED",
]);
function statusTone(status: string, blocked: boolean) {
  if (blocked) return "warn";
  if (/^Saved/.test(status)) return "ok";
  if (/^(Loading|Saving|Unsaved|Undo|Preparing|Proposal ready)/.test(status))
    return "info";
  return "warn";
}
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
  const { ids: bucket } = useBucket();
  const [layoutReset, setLayoutReset] = useState(0);
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
    [past, setPast] = useState<{ items: Item[]; services: Services }[]>([]),
    [settings, setSettings] = useState<TransportSettings>(
      defaultTransportSettings,
    ),
    // Where the traveller is staying, while they fill it in from a warning.
    [base, setBase] = useState<{
      accommodation: string;
      zoneId: Profile["zoneId"];
    } | null>(null);
  // Which guide add-ons are switched on; null follows the saved services.
  const [guideModes, setGuideModes] = useState<{
    activity: boolean;
    fullDay: boolean;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    library = useRef<HTMLDialogElement>(null);
  const pendingAdd = useRef<string | null>(null);
  const libraryDismiss = useBackdropDismiss(library),
    editDismiss = useBackdropDismiss(dialog);
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
        if (data.settings) setSettings(data.settings);
        // A link may open a particular day, e.g. from the checkout prompt,
        // and ask to add an activity, e.g. from "Add to trip".
        const query = new URLSearchParams(window.location.search);
        const requested = query.get("day");
        pendingAdd.current = query.get("add");
        const days = tripDays(data.trip.profile);
        // Open on today or later, so a trip already under way doesn't land
        // on a day that has passed.
        setDay(
          requested && days.includes(requested)
            ? requested
            : (days.find((d) => d >= lagosToday()) ?? days[0]),
        );
        setStatus("Saved · nothing is booked yet");
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, [root, receive]);
  useEffect(() => {
    const offerId = pendingAdd.current;
    if (!offerId || !day || !services) return;
    pendingAdd.current = null;
    window.history.replaceState(null, "", window.location.pathname);
    const offer = offers.find((o) => o.offer.id === offerId);
    if (offer) add(offer);
    else setStatus("That activity is no longer listed.");
    // Runs once the plan and its offers have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, services, offers]);
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
      setStatus("Saved · estimate updated");
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
  // A car-for-the-day that is missing or no longer covers the day's
  // activities is refitted to them; one that still works is left alone.
  function refitCars(nextItems: Item[], base: Services) {
    if (!trip) return base;
    let next = base;
    for (const date of tripDays(trip.profile)) {
      if (dayTransport(trip.profile, next, date) !== "CAR") continue;
      const dated = nextItems
        .filter(
          (i) =>
            i.localDate === date &&
            i.kind === "EXPERIENCE" &&
            offers.some((o) => o.offer.id === i.offerId),
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const night = nightGroup(dated, next, date, settings);
      const daytime = dated.filter((i) => !night.includes(i));
      if (!daytime.length) continue;
      const offerFor = (itemId: string) =>
        offers.find(
          (o) => o.offer.id === dated.find((i) => i.id === itemId)?.offerId,
        )!;
      const current = next.vehicleWindows[date];
      if (current && carCovers(trip.profile.zoneId, daytime, offerFor, current))
        continue;
      const fit = fitCar(trip.profile.zoneId, daytime, offerFor, settings);
      if (fit || !current)
        next = {
          ...next,
          vehicleWindows: {
            ...next.vehicleWindows,
            [date]: fit ?? {
              startTime: "08:00",
              hours: longestDayBlock(settings),
            },
          },
        };
    }
    return next;
  }
  function change(nextItems: Item[], given = services, autoFit = true) {
    if (!services || !given || !trip || busy) return false;
    const nextServices = autoFit ? refitCars(nextItems, given) : given;
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
    setStatus("Unsaved changes · updating estimate…");
    return true;
  }
  async function saveBase() {
    if (!trip || !base || dirty || busy) return;
    setBusy(true);
    try {
      await api(root, "PATCH", {
        expectedVersion: trip.version,
        profile: {
          ...trip.profile,
          accommodation: base.accommodation.trim(),
          zoneId: base.zoneId,
        },
      });
      const data = await api(`${root}/workspace`);
      receive(data);
      setOffers(data.offers);
      if (data.settings) setSettings(data.settings);
      setBase(null);
      setStatus(`Saved · pickups from ${base.accommodation.trim()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
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
        "This experience can’t fit this day. Its opening hours, sessions, length or travel time clash with your plans — try another day.",
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
            // The service day runs to 06:00 the next morning.
            1800,
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
    setStatus("Preparing a suggested plan…");
    try {
      setProposal(
        await api(`${root}/plan`, "POST", { selectedOfferIds: bucket }),
      );
      setStatus("Proposal ready. Review the changes before applying them.");
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
        (!category ||
          (category === "events" ? isEvent(e) : e.categoryId === category)) &&
        // Only list dated events that run during this trip.
        (!trip ||
          !isEvent(e) ||
          eventDates(e, trip.profile.startDate, trip.profile.endDate).length >
            0) &&
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
      if (!trip) return { e, starts, score: 0, note: undefined };
      const runsOn = isEvent(e)
        ? eventDates(e, trip.profile.startDate, trip.profile.endDate)
        : [];
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
        Number(runsOn.includes(day)) * 6 +
        (shuffle
          ? (((index + shuffle) % offers.length) / offers.length) * 8
          : 0);
      const reason = runsOn.includes(day)
        ? "On today only"
        : e.zoneId === trip.profile.zoneId
          ? "Near your base"
          : nearby
            ? "Near today’s plans"
            : trip.profile.interests.includes(
                  e.categoryId as Profile["interests"][number],
                )
              ? "Matches your interests"
              : undefined;
      const note = starts.length
        ? [reason, `fits from ${starts[0].startTime}`]
            .filter(Boolean)
            .join(" · ")
            .replace(/^f/, "F")
        : undefined;
      const when = runsOn.length
        ? eventWhen(e, trip.profile.startDate, trip.profile.endDate)
        : undefined;
      const otherDay = runsOn.find((d) => d !== day);
      return { e, starts, score, note, when, otherDay };
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
    if (at < 0 || at + duration > 1800) return null;
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
    return change(
      [...items.filter((item) => item.id !== candidate.id), candidate],
      services,
    );
  }
  // Days before today can't take bookings; today is judged per experience by
  // its own booking cutoff.
  const dayClosed = day < lagosToday();
  const libraryContents = (
    <div className="library-shell compact-library">
      <div className="library-controls">
        <div className="library-tabs">
          <div className="segmented" role="group" aria-label="Activity source">
            <button
              type="button"
              aria-pressed={view === "bucket"}
              onClick={() => setView("bucket")}
            >
              My Bucket <span className="count">{bucket.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={view === "all"}
              onClick={() => setView("all")}
            >
              All Experiences
            </button>
          </div>
          <button
            type="button"
            className="shuffle-button secondary"
            title="Refresh suggestions without changing your itinerary"
            aria-label="Shuffle suggestions"
            onClick={() => {
              setView("all");
              setShuffle((n) => n + 1);
            }}
          >
            <Icon name="shuffle" size={16} />
            <span className="shuffle-label">Shuffle</span>
          </button>
        </div>
        <div className="library-filters">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="sr-only">Search activities</span>
            <input
              type="search"
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
              <option value="events">What’s on</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {dayClosed && (
          <p className="notice" role="status">
            {trip && trip.profile.endDate < lagosToday()
              ? "These trip dates have passed, so nothing can be booked for them."
              : "This day has passed, so nothing can be booked for it."}{" "}
            <Link className="text-link" href={`/trips/${id}/profile`}>
              Change trip dates
            </Link>
          </p>
        )}
        {view === "bucket" ? (
          <div className="bucket-navigation">
            <Link
              className="text-link"
              href={`/explore?trip=${encodeURIComponent(id)}`}
            >
              <Icon name="compass" size={16} />
              Explore more experiences
            </Link>
            <ClearBucket />
          </div>
        ) : (
          <p className="library-hint">
            {shuffle
              ? "Fresh suggestions for this day. Your itinerary hasn’t changed."
              : "Best fits for this day first. Drag a card into your day, or use Add to day."}
          </p>
        )}
        {replacing && (
          <div className="replacement-hint" role="status">
            <span>
              Choose a replacement for <strong>{replacing.title}</strong>.
              You’ll confirm before anything changes.
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => setReplacing(null)}
            >
              Cancel
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
            <Icon name={view === "bucket" ? "bookmark" : "search"} size={26} />
            <h3>
              {view === "bucket" && !bucket.length
                ? "Your bucket is empty."
                : "No matching experiences"}
            </h3>
            <p>
              {view === "bucket" && !bucket.length
                ? "Save favourites while you explore, or browse All Experiences here."
                : "Try another category or search."}
            </p>
            {view === "bucket" && !bucket.length ? (
              <button
                type="button"
                className="secondary"
                onClick={() => setView("all")}
              >
                Browse All Experiences
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                }}
              >
                Clear search
              </button>
            )}
          </div>
        )}
        {libraryEntries.map(({ e, starts, note, when, otherDay }) => (
          <PlannerActivityCard
            key={e.offer.id}
            experience={e}
            saved={bucket.includes(e.offer.id)}
            busy={busy}
            available={!!starts.length}
            note={note}
            unavailableReason={
              dayClosed
                ? "This day has passed."
                : pastBookingCutoff(e, day)
                  ? e.offer.bookingCutoffHours
                    ? `Too late for this day: book at least ${e.offer.bookingCutoffHours} hours ahead.`
                    : "Too late to book for this day."
                  : undefined
            }
            when={when}
            otherDay={
              !starts.length && otherDay
                ? {
                    label: eventDay(otherDay),
                    go: () => setDay(otherDay),
                  }
                : undefined
            }
            onAdd={() => add(e)}
            onDrag={setDragging}
          />
        ))}
      </div>
    </div>
  );
  if (!trip || !services)
    return (
      <section className="page-status">
        <div className="spinner" aria-hidden="true" />
        <p role="status">{status}</p>
        <Link className="text-link" href="/trips">
          Return to my trips
        </Link>
      </section>
    );
  const days = tripDays(trip.profile),
    dayItems = items
      .filter((i) => i.localDate === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    hasActivities = dayItems.some((i) => i.kind === "EXPERIENCE");
  const dayLabel = (date: string) =>
    `Day ${days.indexOf(date) + 1} · ${shortDate(date)}`;
  const issues = price ? [...price.blockers, ...price.warnings] : [];
  const tone = statusTone(status, blocked);
  // Days with something to sort out, marked on the day ribbon.
  const issueDays = new Set(
    issues.flatMap((issue) => {
      const date =
        items.find((item) => item.id === issue.itemId)?.localDate ??
        /^(\d{4}-\d{2}-\d{2}):/.exec(issue.message)?.[1];
      return date ? [date] : [];
    }),
  );
  const modes = guideModes ?? {
    activity: services.guideItemIds.length > 0,
    fullDay: services.guideDays.length > 0,
  };
  const guidedDay = services.guideDays.includes(day);
  const ownTransport = trip.profile.transport === "OWN";
  const mode = dayTransport(trip.profile, services, day);
  const dayCar = mode === "CAR";
  // Booked experiences on this day, split between the day and a night car.
  const dayExperiences = dayItems.filter(
    (i) =>
      i.kind === "EXPERIENCE" && offers.some((o) => o.offer.id === i.offerId),
  );
  const offerFor = (itemId: string) =>
    offers.find(
      (o) => o.offer.id === dayItems.find((i) => i.id === itemId)?.offerId,
    )!;
  const nightWindow = services.nightWindows?.[day];
  const nightItems = nightGroup(dayExperiences, services, day, settings);
  const daytime = dayExperiences.filter((i) => !nightItems.includes(i));
  // Night activities a night car could cover, whether or not it's added.
  const lateStarts = dayExperiences.filter(
    (i) => i.startTime >= settings.night.startsFrom,
  );
  const lateFinishes =
    mode === "OWN"
      ? daytime.filter((i) => i.endTime >= settings.lateReturnFrom)
      : [];
  const dayWindow = services.vehicleWindows[day];
  // A full-day guide starts with the day car, or at the first activity.
  const firstActivity = dayItems.find((i) => i.kind === "EXPERIENCE");
  const dayGuideStart =
    (dayCar && daytime.length && dayWindow?.startTime) ||
    firstActivity?.startTime;
  const noticeHours = settings.guideNoticeHours;
  const dayGuideTooLate =
    !!dayGuideStart &&
    guideTooLate(day, dayGuideStart, Date.now(), noticeHours);
  const fitDay = () => fitCar(trip.profile.zoneId, daytime, offerFor, settings);
  const fitNight = () =>
    fitCar(trip.profile.zoneId, lateStarts, offerFor, settings, "NIGHT");
  function setGuides(
    next: Partial<Pick<Services, "guideDays" | "guideItemIds">>,
  ) {
    const merged = { ...services!, ...next };
    return change(items, { ...merged, assistance: assistanceFor(merged) });
  }
  function setDayMode(next: "CAR" | "OWN") {
    const overrides = { ...services!.dayTransport };
    // Matching the trip's choice needs no override.
    if (next === (ownTransport ? "OWN" : "CAR")) delete overrides[day];
    else overrides[day] = next;
    change(items, { ...services!, dayTransport: overrides });
  }
  function setDayWindow(window: { startTime: string; hours: number }) {
    change(
      items,
      {
        ...services!,
        vehicleWindows: { ...services!.vehicleWindows, [day]: window },
      },
      false,
    );
  }
  function setNightCar(on: boolean) {
    const nights = { ...services!.nightWindows };
    if (on)
      nights[day] = {
        startTime: fitNight()?.startTime ?? settings.night.startsFrom,
      };
    else delete nights[day];
    change(items, { ...services!, nightWindows: nights });
  }
  function setOwnWayBack(itemId: string, on: boolean) {
    const ids = services!.ownWayBack ?? [];
    change(items, {
      ...services!,
      ownWayBack: on ? [...ids, itemId] : ids.filter((i) => i !== itemId),
    });
  }
  const serviceControls = (
    <>
      <div className="services-intro">
        <h2>Your support</h2>
        <p className="muted">
          Choose a car and driver or your own way for each day. Add guides on
          top, in any mix, at least {noticeHours} hours before they start.
          Personal time is never supervised, and there’s no 24-hour hosting.
        </p>
      </div>
      <fieldset className="assistance-options" disabled={busy}>
        <legend className="sr-only">Support for your trip</legend>
        {/* The trip's default; each day can differ below. */}
        <div className="assistance-card" data-selected="true">
          <Icon name="car" size={24} />
          <strong>
            {ownTransport ? "Your own way, usually" : "Car and driver, usually"}
          </strong>
          <span>
            {ownTransport
              ? "No car to pay for unless you add one to a day."
              : "Pickup, waiting time and your return on activity days."}{" "}
            Change any day below, or{" "}
            <Link className="text-link" href={`/trips/${id}/profile`}>
              the whole trip
            </Link>
            .
          </span>
        </div>
        <label className="assistance-card" data-selected={modes.activity}>
          <input
            type="checkbox"
            checked={modes.activity}
            onChange={(e) => {
              if (!e.target.checked && !setGuides({ guideItemIds: [] })) return;
              setGuideModes({ ...modes, activity: e.target.checked });
            }}
          />
          <Icon name="users" size={24} />
          <strong>Guides for chosen activities</strong>
          <span>
            A local guide for the activities you tick, up to 3 hours each.{" "}
            {money(rules.activityGuideBlock.rateMinor)} per activity.
          </span>
        </label>
        <label className="assistance-card" data-selected={modes.fullDay}>
          <input
            type="checkbox"
            checked={modes.fullDay}
            onChange={(e) => {
              if (!e.target.checked && !setGuides({ guideDays: [] })) return;
              setGuideModes({ ...modes, fullDay: e.target.checked });
            }}
          />
          <Icon name="sun" size={24} />
          <strong>Full-day guide</strong>
          <span>
            An 8-hour guide from your car’s start time, or your first activity
            on own-way days. {money(rules.guideDayBlock.rateMinor)} per day.
          </span>
        </label>
      </fieldset>
      {modes.activity && modes.fullDay && (
        <p className="services-mix-note">
          <Icon name="info" size={16} />
          On a day with a full-day guide, activity guides aren’t charged — the
          full-day guide already covers them.
        </p>
      )}
      <section className="service-day">
        <h3>{dayLabel(day)}</h3>
        {hasActivities ? (
          <>
            <div
              className="segmented"
              role="group"
              aria-label="Getting around on this day"
            >
              <button
                type="button"
                disabled={busy}
                aria-pressed={dayCar}
                onClick={() => setDayMode("CAR")}
              >
                Car and driver
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={!dayCar}
                onClick={() => setDayMode("OWN")}
              >
                Our own way
              </button>
            </div>
            {!dayCar ? (
              <p className="muted">
                You’re getting yourselves to each activity on this day. Allow
                the travel times shown in your plan.
              </p>
            ) : !daytime.length ? (
              <p className="muted">
                Only night activities today: the night car below covers them.
              </p>
            ) : (
              <>
                <div className="field-grid">
                  <label>
                    Car from
                    <input
                      disabled={busy}
                      type="time"
                      value={dayWindow?.startTime ?? "08:00"}
                      onChange={(e) =>
                        setDayWindow({
                          startTime: e.target.value,
                          hours: dayWindow?.hours ?? longestDayBlock(settings),
                        })
                      }
                    />
                  </label>
                  <label>
                    Hours
                    <select
                      disabled={busy}
                      value={dayWindow?.hours ?? ""}
                      onChange={(e) =>
                        setDayWindow({
                          startTime: dayWindow?.startTime ?? "08:00",
                          hours: Number(e.target.value),
                        })
                      }
                    >
                      <option value="" disabled>
                        Choose hours
                      </option>
                      {settings.dayBlocks.map((b) => (
                        <option key={b.hours} value={b.hours}>
                          {b.hours} hours · {money(b.rateMinor)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted">
                  {dayWindow
                    ? `Until ${clockLabel(time(minutes(dayWindow.startTime) + dayWindow.hours * 60))}. `
                    : ""}
                  Covers pickup, waiting between activities and your return.
                  Travel times are estimates.{" "}
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || !fitDay()}
                    onClick={() => {
                      const fit = fitDay();
                      if (fit) setDayWindow(fit);
                    }}
                  >
                    Fit to my plan
                  </button>
                  {!fitDay() &&
                    ` This day is longer than ${longestDayBlock(settings)} hours: add a night car for the evening, or make your own way for part of it.`}
                </p>
              </>
            )}
            {lateFinishes.map((i) => (
              <label key={i.id} className="check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={services.ownWayBack?.includes(i.id) ?? false}
                  onChange={(e) => setOwnWayBack(i.id, e.target.checked)}
                />
                I’ll arrange our own way back from {displayName(i.title)} (ends{" "}
                {clockLabel(i.endTime)})
              </label>
            ))}
            {(lateStarts.length > 0 || nightWindow) && (
              <div className="night-car">
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={!!nightWindow}
                    onChange={(e) => setNightCar(e.target.checked)}
                  />
                  Night car: a separate driver for {settings.night.hours} hours
                  from {settings.night.startsFrom} or later, waits and brings
                  you back. {money(settings.night.rateMinor)} per car.
                </label>
                {nightWindow && (
                  <label>
                    Night car from
                    <input
                      disabled={busy}
                      type="time"
                      min={settings.night.startsFrom}
                      value={nightWindow.startTime}
                      onChange={(e) =>
                        change(
                          items,
                          {
                            ...services,
                            nightWindows: {
                              ...services.nightWindows,
                              [day]: { startTime: e.target.value },
                            },
                          },
                          false,
                        )
                      }
                    />
                    <small className="form-hint">
                      Until{" "}
                      {clockLabel(
                        time(
                          minutes(nightWindow.startTime) +
                            settings.night.hours * 60,
                        ),
                      )}
                      . Covers {nightItems.length}{" "}
                      {nightItems.length === 1 ? "activity" : "activities"}{" "}
                      starting from {settings.night.startsFrom}.
                    </small>
                  </label>
                )}
              </div>
            )}
            {modes.fullDay && (
              <label className="check">
                <input
                  disabled={busy || (dayGuideTooLate && !guidedDay)}
                  type="checkbox"
                  checked={guidedDay}
                  onChange={(e) =>
                    setGuides({
                      guideDays: e.target.checked
                        ? [...services.guideDays, day]
                        : services.guideDays.filter((d) => d !== day),
                    })
                  }
                />
                Full-day guide on this day (8 hours from{" "}
                {dayCar && daytime.length
                  ? "the car’s start time"
                  : "your first activity"}
                )
                {dayGuideTooLate &&
                  ` · too late: book at least ${noticeHours} hours ahead`}
              </label>
            )}
            {modes.activity &&
              dayItems
                .filter((i) => i.kind === "EXPERIENCE")
                .map((i) => {
                  const included = offers.find((e) => e.offer.id === i.offerId)
                    ?.offer.hostIncluded;
                  const chosen = services.guideItemIds.includes(i.id);
                  const tooLate = guideTooLate(
                    i.localDate,
                    i.startTime,
                    Date.now(),
                    noticeHours,
                  );
                  return (
                    <label key={i.id} className="check">
                      <input
                        type="checkbox"
                        disabled={
                          busy || included || guidedDay || (tooLate && !chosen)
                        }
                        checked={included || guidedDay || chosen}
                        onChange={(e) =>
                          setGuides({
                            guideItemIds: e.target.checked
                              ? [...services.guideItemIds, i.id]
                              : services.guideItemIds.filter(
                                  (id) => id !== i.id,
                                ),
                          })
                        }
                      />
                      Guide for {displayName(i.title)}
                      {included
                        ? " · host already included"
                        : guidedDay
                          ? " · covered by the full-day guide"
                          : tooLate
                            ? ` · too late: book at least ${noticeHours} hours ahead`
                            : ""}
                    </label>
                  );
                })}
          </>
        ) : (
          <p className="muted">
            No car needed — this day has only personal or free time.
          </p>
        )}
      </section>
      <section className="service-day">
        <h3>Arrival extras</h3>
        <p className="muted">
          Airport pickup and arrival help aren’t available to add yet.
        </p>
      </section>
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
  const editingExists = !!editing && items.some((i) => i.id === editing.id);
  const dayEnd = dayWindow
    ? minutes(dayWindow.startTime) + dayWindow.hours * 60
    : 0;
  const nightStart = nightWindow ? minutes(nightWindow.startTime) : 0;
  const nightEnd = nightStart + settings.night.hours * 60;
  const coverage = [
    ...(dayCar && daytime.length && dayWindow
      ? [
          {
            kind: "day" as const,
            label: `Driver ${clockLabel(dayWindow.startTime)}–${clockLabel(time(dayEnd))}`,
            from: minutes(dayWindow.startTime),
            to: dayEnd,
          },
        ]
      : []),
    ...(nightWindow
      ? [
          {
            kind: "night" as const,
            label: `Night car ${clockLabel(nightWindow.startTime)}–${clockLabel(time(nightEnd))}`,
            from: nightStart,
            to: nightEnd,
          },
        ]
      : []),
  ];
  const transportLine = hasActivities && (
    <p className="day-transport">
      <Icon name="car" size={16} />
      <span>
        {!dayCar ? (
          "Making your own way today"
        ) : !daytime.length ? (
          "No daytime driver needed"
        ) : dayWindow ? (
          <>
            <strong>
              Driver {clockLabel(dayWindow.startTime)}–
              {clockLabel(time(dayEnd))}
            </strong>{" "}
            · {dayWindow.hours} hours
          </>
        ) : (
          "Driver time not chosen yet"
        )}
        {nightWindow && (
          <>
            {" · "}
            <strong>
              Night car {clockLabel(nightWindow.startTime)}–
              {clockLabel(time(nightEnd))}
            </strong>
          </>
        )}
      </span>
      <Link className="text-link" href={`/trips/${id}/services?day=${day}`}>
        Change
      </Link>
    </p>
  );
  const scheduleContents = (
    <PlannerTimeline
      transport={transportLine}
      coverage={coverage}
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
        if (window.matchMedia("(max-width: 900px)").matches)
          library.current?.showModal();
      }}
    />
  );
  const priceSummary = (
    <details className="price-popover">
      <summary>
        <span className="price-label">Estimated total</span>
        <strong aria-busy={dirty}>
          {money(price?.totalMinor ?? 0)}
          {dirty ? " *" : ""}
        </strong>
        <Icon name="chevronDown" size={16} />
      </summary>
      <div className="price-popover-content">
        <h2>Cost breakdown</h2>
        {price && price.totalMinor > 0 ? (
          <dl className="price-lines">
            <dt>Activities</dt>
            <dd>{money(price.activitiesMinor)}</dd>
            <dt>Transport</dt>
            <dd>
              {trip.profile.transport === "OWN"
                ? "Your own"
                : money(price.transportMinor)}
            </dd>
            <dt>Guides & hosting</dt>
            <dd>{money(price.hostingMinor)}</dd>
            <dt>Service fee</dt>
            <dd>{money(price.feeMinor)}</dd>
            <dt>Tax</dt>
            <dd>{money(price.taxMinor)}</dd>
            <dt className="price-total">Total</dt>
            <dd className="price-total">{money(price.totalMinor)}</dd>
          </dl>
        ) : (
          <p className="muted">Add activities to see your estimate.</p>
        )}
        {dirty && <p className="muted">* Recalculating after your change.</p>}
        <p className="price-note">
          <Icon name="info" size={16} />
          Prices update automatically as you plan. Booking isn’t open in this
          preview, so nothing is reserved or charged.
        </p>
      </div>
    </details>
  );
  const checkout = (
    <CheckoutButton
      tripId={id}
      profile={trip.profile}
      items={items}
      disabled={busy}
      beforeLeave={async () => !dirty || (await save())}
      // On the services page the button opens the planner at that day.
      onPlanDay={servicesOnly ? undefined : setDay}
    />
  );
  return (
    <section className="planner-page planner-refined">
      <header className="planner-heading">
        <div className="planner-title">
          <h1>
            My trip planner
            {servicesOnly && (
              <span className="planner-mode">Driver & guides</span>
            )}
          </h1>
          <ul className="trip-facts">
            <li>
              <Icon name="calendar" size={15} />
              {shortDate(days[0])} – {shortDate(days.at(-1)!)} · {days.length}{" "}
              days
            </li>
            <li>
              <Icon name="users" size={15} />
              {trip.profile.adults} adults
            </li>
            <li>
              <Icon name="pin" size={15} />
              {trip.profile.accommodation ||
                (trip.profile.zoneId !== "UNDECIDED"
                  ? zoneLabel(trip.profile.zoneId)
                  : "Base not set")}
            </li>
          </ul>
          <div className="planner-status">
            <p
              className="planner-save-state"
              role="status"
              aria-live="polite"
              data-tone={tone}
            >
              <Icon
                name={
                  tone === "ok" ? "check" : tone === "warn" ? "alert" : "clock"
                }
                size={14}
              />
              {status}
            </p>
            {issues.length > 0 && (
              <details
                className="planner-validation"
                data-blocking={!!price?.blockers.length}
              >
                <summary>
                  <Icon name="alert" size={14} />
                  {price?.blockers.length
                    ? `${price.blockers.length} ${price.blockers.length === 1 ? "thing" : "things"} to sort out before booking`
                    : `${issues.length} planning ${issues.length === 1 ? "tip" : "tips"}`}
                  <Icon name="chevronDown" size={14} />
                </summary>
                <ul>
                  {issues.map((issue, index) => {
                    const target = items.find(
                      (item) => item.id === issue.itemId,
                    );
                    const date =
                      target?.localDate ??
                      /^(\d{4}-\d{2}-\d{2}):/.exec(issue.message)?.[1];
                    const dayName = date
                      ? `Day ${days.indexOf(date) + 1}`
                      : "your trip";
                    if (issue.code === "MISSING_BASE")
                      return (
                        <li key={index} className="issue-base">
                          {friendlyIssue(issue.message, days)}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveBase();
                            }}
                          >
                            <label>
                              Where you’re staying
                              <input
                                required
                                maxLength={300}
                                placeholder="Hotel name, or street and area"
                                value={
                                  base?.accommodation ??
                                  trip.profile.accommodation
                                }
                                onChange={(e) =>
                                  setBase({
                                    zoneId: base?.zoneId ?? trip.profile.zoneId,
                                    accommodation: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Area
                              <select
                                required
                                value={base?.zoneId ?? trip.profile.zoneId}
                                onChange={(e) =>
                                  setBase({
                                    accommodation:
                                      base?.accommodation ??
                                      trip.profile.accommodation,
                                    zoneId: e.target.value as Profile["zoneId"],
                                  })
                                }
                              >
                                <option value="UNDECIDED" disabled>
                                  Choose an area
                                </option>
                                <option value="LEKKI">Lekki</option>
                                <option value="VI">Victoria Island</option>
                                <option value="MAINLAND">Mainland</option>
                              </select>
                            </label>
                            <button
                              type="submit"
                              disabled={
                                busy ||
                                dirty ||
                                !(
                                  base?.accommodation ??
                                  trip.profile.accommodation
                                ).trim() ||
                                (base?.zoneId ?? trip.profile.zoneId) ===
                                  "UNDECIDED"
                              }
                            >
                              Save address
                            </button>
                            {dirty && (
                              <small className="form-hint">
                                Your latest changes are still saving.
                              </small>
                            )}
                          </form>
                        </li>
                      );
                    return (
                      <li key={index}>
                        {friendlyIssue(issue.message, days)}
                        {driverCodes.has(issue.code) ? (
                          servicesOnly ? (
                            date &&
                            date !== day && (
                              <button
                                className="text-button"
                                onClick={() => setDay(date)}
                              >
                                Show {dayName}
                              </button>
                            )
                          ) : (
                            <Link
                              className="text-link"
                              href={`/trips/${id}/services${date ? `?day=${date}` : ""}`}
                            >
                              Fix in Driver & guides
                              {date ? ` for ${dayName}` : ""}
                            </Link>
                          )
                        ) : (
                          target &&
                          target.localDate !== day && (
                            <button
                              className="text-button"
                              onClick={() => setDay(target.localDate)}
                            >
                              Show {dayLabel(target.localDate)}
                            </button>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>
        </div>
        <div className="planner-heading-side">
          <nav className="planner-links" aria-label="Trip">
            <Link className="text-link" href={`/trips/${id}/profile`}>
              <Icon name="edit" size={16} />
              Edit trip profile
            </Link>
            <Link className="text-link" href={`/trips/${id}/today`}>
              <Icon name="sun" size={16} />
              Day view
            </Link>
          </nav>
          <div className="compact-price">
            {priceSummary}
            <Link
              className={servicesOnly ? "button secondary" : "button"}
              href={`/trips/${id}/${servicesOnly ? "plan" : "services"}`}
            >
              {servicesOnly ? "Back to planner" : "Driver & guides"}
              {!servicesOnly && <Icon name="arrowRight" size={16} />}
            </Link>
          </div>
        </div>
      </header>
      <div className="day-strip">
        <div className="day-chips compact-days" aria-label="Trip days">
          {days.map((date, index) => {
            const count = items.filter(
              (item) => item.localDate === date,
            ).length;
            const full = items.some(
              (item) =>
                item.localDate === date &&
                offers.find((e) => e.offer.id === item.offerId)?.kind ===
                  "FULL_DAY",
            );
            const events = offers.filter(
              (e) => eventDates(e, date, date).length,
            ).length;
            const part = (option: Intl.DateTimeFormatOptions) =>
              new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
                ...option,
                timeZone: "UTC",
              });
            // The month shows where the trip starts and where it turns over.
            const month =
              index === 0 || date.slice(5, 7) !== days[index - 1].slice(5, 7);
            return (
              <button
                key={date}
                className="day-cell"
                title={`Day ${index + 1} · ${part({ weekday: "long", day: "numeric", month: "long" })}`}
                aria-pressed={date === day}
                onClick={() => setDay(date)}
                disabled={busy}
                data-drop={
                  dragging?.kind === "item"
                    ? (() => {
                        const existing = items.find(
                          (item) => item.id === dragging.id,
                        );
                        const candidate =
                          existing &&
                          candidateAt(
                            dragging,
                            minutes(existing.startTime),
                            date,
                          );
                        return candidate &&
                          !placementIssues(
                            trip.profile,
                            [
                              ...items.filter((i) => i.id !== candidate.id),
                              candidate,
                            ],
                            services,
                            offers,
                          ).length
                          ? "valid"
                          : "invalid";
                      })()
                    : undefined
                }
                onDragOver={(event) => {
                  if (dragging) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging?.kind === "item") {
                    const existing = items.find(
                      (item) => item.id === dragging.id,
                    );
                    if (existing) {
                      const candidate = candidateAt(
                        dragging,
                        minutes(existing.startTime),
                        date,
                      );
                      if (candidate) commitCandidate(candidate);
                      else
                        setStatus(
                          "Choose a valid alternative session using Edit.",
                        );
                    }
                  }
                  setDragging(null);
                }}
              >
                <span className="day-number">Day {index + 1}</span>
                <span className="day-top" aria-hidden="true">
                  <span className="day-weekday">
                    {part({ weekday: "short" })}
                  </span>
                  {issueDays.has(date) && <i className="day-issue" />}
                  {events > 0 && <b className="day-events">{events}</b>}
                </span>
                <span className="day-date">
                  <strong>{part({ day: "numeric" })}</strong>
                  <span data-month={month || undefined}>
                    {part({ month: "short" })}
                  </span>
                </span>
                <span
                  className="day-load"
                  data-full={full || undefined}
                  aria-hidden="true"
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <i key={i} data-on={full || i < count || undefined} />
                  ))}
                </span>
                <span className="sr-only">
                  {full ? "Full day" : `${count} planned`}
                </span>
                {issueDays.has(date) && (
                  <span className="sr-only">Something to sort out</span>
                )}
                {events > 0 && (
                  <span className="sr-only">
                    {events} {events === 1 ? "event" : "events"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          className="workspace-actions"
          role="toolbar"
          aria-label="Plan tools"
        >
          <button
            className="icon-button tool-button"
            aria-label="Undo"
            title="Undo"
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
            <Icon name="undo" size={18} />
          </button>
          {!servicesOnly && (
            <button
              className="icon-button tool-button reset-layout"
              aria-label="Reset layout"
              title="Reset layout"
              onClick={() => setLayoutReset((n) => n + 1)}
            >
              <Icon name="layout" size={18} />
            </button>
          )}
          <button
            className="secondary save-button"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            Save
          </button>
          {!servicesOnly && (
            <button
              className="suggest-button"
              disabled={busy || dirty}
              onClick={generate}
              title="Kemi drafts a plan from your bucket. You review every change first."
            >
              <Icon name="sparkle" size={16} />
              Suggest a plan
            </button>
          )}
        </div>
      </div>
      {blocked && (
        <div className="field-error">
          Your latest changes couldn’t be saved. They’re still here.
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
                if (data.settings) setSettings(data.settings);
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
      {proposal && (
        <div className="proposal" role="region" aria-label="Suggested plan">
          <div className="proposal-head">
            <span className="kemi-avatar" aria-hidden="true">
              K
            </span>
            <div>
              <p className="eyebrow">Suggestion · your plan hasn’t changed</p>
              <h2>Review Kemi’s suggested changes</h2>
              <p>
                {proposal.diff.added.length} to add ·{" "}
                {proposal.diff.removed.length} to remove · locked items stay put
                · new estimate {money(proposal.price.totalMinor)} (
                {proposal.price.totalMinor - (price?.totalMinor ?? 0) >= 0
                  ? "+"
                  : "−"}
                {money(
                  Math.abs(
                    proposal.price.totalMinor - (price?.totalMinor ?? 0),
                  ),
                )}
                )
              </p>
            </div>
          </div>
          {proposal.questions.map((question) => (
            <p className="notice" key={question}>
              {question}
            </p>
          ))}
          <div className="proposal-diff">
            <div>
              <h3>Remove</h3>
              {proposal.diff.removed.length ? (
                <ul>
                  {proposal.diff.removed.map((i) => (
                    <li key={i.id} data-change="remove">
                      <span>
                        {shortDate(i.localDate)} · {i.startTime}
                      </span>
                      {i.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing removed.</p>
              )}
            </div>
            <div>
              <h3>Add</h3>
              {proposal.diff.added.length ? (
                <ul>
                  {proposal.diff.added.map((i) => (
                    <li key={i.id} data-change="add">
                      <span>
                        {shortDate(i.localDate)} · {clockLabel(i.startTime)}–
                        {clockLabel(i.endTime)}
                      </span>
                      {i.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing added.</p>
              )}
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
                  setStatus("Saved · suggestion applied. Nothing is booked.");
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
      <div className="planner-with-cost" data-services={servicesOnly}>
        {servicesOnly ? (
          <div className="services-workspace">{serviceControls}</div>
        ) : (
          <PlannerSplit
            resetKey={layoutReset}
            library={libraryContents}
            schedule={scheduleContents}
          />
        )}
        <aside className="planner-cost-panel" aria-label="Trip cost">
          <TripCost
            profile={trip.profile}
            price={price}
            items={items}
            dirty={dirty}
            currentDay={day}
            onSelectDay={setDay}
            footer={checkout}
          />
        </aside>
      </div>
      <dialog
        ref={library}
        className="sheet-dialog library-sheet"
        {...libraryDismiss}
      >
        <div className="sheet-header">
          <h2>Choose an activity</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close experience library"
            onClick={() => library.current?.close()}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet-body">{libraryContents}</div>
      </dialog>
      <dialog
        ref={dialog}
        className="sheet-dialog edit-dialog"
        aria-labelledby="edit-dialog-title"
        onCancel={() => setEditing(null)}
        onClose={() => setEditing(null)}
        {...editDismiss}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const accepted = change(
                editingExists
                  ? items.map((i) => (i.id === editing.id ? editing : i))
                  : [...items, editing],
                services,
              );
              if (accepted) {
                dialog.current?.close();
                setEditing(null);
                setReplacing(null);
              }
            }}
          >
            <div className="sheet-header">
              <div>
                <p className="eyebrow">
                  {editing.kind === "EXPERIENCE"
                    ? editingOffer?.schedulingType === "FIXED"
                      ? "Set sessions"
                      : editingOffer?.kind === "FULL_DAY"
                        ? "Full day"
                        : "Flexible time"
                    : "Personal time"}
                </p>
                <h2 id="edit-dialog-title">
                  {replacing
                    ? "Confirm replacement"
                    : editingExists
                      ? "Edit / move block"
                      : "Add to your day"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => {
                  dialog.current?.close();
                  setEditing(null);
                }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="sheet-body edit-fields">
              {replacing && (
                <div className="notice">
                  <h3>
                    {replacing.title} → {editing.title}
                  </h3>
                  <p>
                    {clockLabel(replacing.startTime)}–
                    {clockLabel(replacing.endTime)} becomes{" "}
                    {clockLabel(editing.startTime)}–
                    {clockLabel(editing.endTime)}. Activity price change:{" "}
                    {money(
                      (offers.find((e) => e.offer.id === editing.offerId)?.offer
                        .rateMinor ?? 0) *
                        (offers.find((e) => e.offer.id === editing.offerId)
                          ?.offer.priceBasis === "PER_ADULT"
                          ? trip.profile.adults
                          : 1) -
                        (offers.find((e) => e.offer.id === replacing.offerId)
                          ?.offer.rateMinor ?? 0) *
                          (offers.find((e) => e.offer.id === replacing.offerId)
                            ?.offer.priceBasis === "PER_ADULT"
                            ? trip.profile.adults
                            : 1),
                    )}
                    . New estimated total:{" "}
                    {money(
                      assess(
                        trip.profile,
                        items.map((i) => (i.id === replacing.id ? editing : i)),
                        services,
                        offers,
                        undefined,
                        settings,
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
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ))}
                </select>
              </label>
              {editingOffer?.schedulingType === "FIXED" && (
                <label>
                  Available sessions
                  <select
                    value={editing.startTime}
                    onChange={(event) => {
                      const session = editingOffer.sessions?.find(
                        (s) => s.startTime === event.target.value,
                      );
                      if (session)
                        setEditing({
                          ...editing,
                          startTime: session.startTime,
                          endTime: time(
                            minutes(session.startTime) +
                              session.durationMinutes,
                          ),
                        });
                    }}
                  >
                    <option value="" disabled>
                      Choose a session
                    </option>
                    {editingOffer.sessions
                      ?.filter((s) =>
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
                          {s.startTime} · {s.durationMinutes} minutes
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="field-grid">
                <label>
                  Start time
                  <input
                    required
                    type="time"
                    step={900}
                    disabled={editingOffer?.schedulingType === "FIXED"}
                    value={time(minutes(editing.startTime) % 1440)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        startTime: sameSide(editing.startTime, e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  End time
                  <input
                    required
                    type="time"
                    step={900}
                    disabled={editingOffer?.schedulingType === "FIXED"}
                    value={time(minutes(editing.endTime) % 1440)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        endTime: sameSide(editing.endTime, e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              {editingOffer?.schedulingType !== "FIXED" && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={minutes(editing.endTime) >= 1440}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        endTime: time(
                          (minutes(editing.endTime) % 1440) +
                            (e.target.checked ? 1440 : 0),
                        ),
                      })
                    }
                  />
                  Ends after midnight (the next morning)
                </label>
              )}
              {editing.kind === "EXPERIENCE" && editingOffer && (
                <p className="form-hint">
                  {editingOffer.schedulingType === "FIXED"
                    ? "Session times are set by the host and can’t be changed."
                    : `${shortestVisit(editingOffer) < editingOffer.durationMinMinutes ? `Usually ${formatDuration(editingOffer.durationMinMinutes, editingOffer.durationMaxMinutes)}; drop in late and stay from ${formatDuration(shortestVisit(editingOffer))}.` : `Lasts ${formatDuration(editingOffer.durationMinMinutes, editingOffer.durationMaxMinutes)}.`} Open ${editingOffer.availabilityLocal.opensAt}–${clockLabel(editingOffer.availabilityLocal.closesAt)}, Lagos time. The whole visit must fit.`}
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
                Lock this block so suggestions don’t change it
              </label>
              <p className="edit-status" role="status">
                {status}
              </p>
            </div>
            <div className="sheet-footer">
              {editingExists && !replacing && (
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() => {
                    if (change(items.filter((i) => i.id !== editing.id))) {
                      dialog.current?.close();
                      setEditing(null);
                    }
                  }}
                >
                  <Icon name="trash" size={16} />
                  Remove
                </button>
              )}
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
              <button type="submit">
                {replacing ? "Confirm replacement" : "Save block"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
