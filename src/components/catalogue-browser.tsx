"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BucketButton, BucketTray, ClearBucket } from "./bucket";
import { useBucket } from "@/hooks/use-bucket";
import { useActiveTrip } from "@/hooks/use-active-trip";
import { photoById } from "@/modules/catalogue/domain/photos";
import { WhatsOn } from "./whats-on";
import ExperienceOverlay from "./experience-overlay";
import Rail from "./rail";
import Icon from "./icons";
import categories from "../../tourism-v1-handoff/data/categories.json";
import type { Experience } from "@/modules/catalogue/domain/experience";
import {
  categoryShortLabels,
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  storyFor,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import {
  eventTypeLabels,
  eventWhen,
  isEvent,
  lagosToday,
} from "@/modules/catalogue/domain/events";
import {
  ageLabel,
  listingDetails,
} from "@/modules/catalogue/domain/listing-details";
import {
  inPriceBand,
  isoDate,
  priceBands,
  rangeDays,
  rangeText,
  runsOn,
  shortDay,
  startTimesOn,
  weekendDates,
  weeklyPattern,
} from "@/modules/catalogue/domain/schedule";
import { defaultDestination } from "@/modules/catalogue/domain/destinations";
export function money(n: number) {
  return formatMoney(n);
}
type Record = Experience & { seedKey: string };
const banner = photoById("lekki-link-bridge");

// One calm card for every listing: photo, a quiet meta line, the name, at
// most one highlight and the price. The Save toggle sits on the photo.
export function ExperienceCard({
  experience: e,
  start,
  end,
  date,
  visit,
}: {
  experience: Experience & { seedKey?: string };
  // Dated events show their first date inside this window.
  start?: string;
  end?: string;
  // A browse date: the card shows its start times that day.
  date?: string;
  // A visit range, carried to the booking panel so it suggests those dates.
  visit?: { from: string; to: string };
}) {
  const { ids } = useBucket();
  const saved = ids.includes(e.offer.id);
  const name = displayName(e.name);
  const details = listingDetails(e);
  const times = date ? startTimesOn(e, date) : [];
  const highlight =
    date && times.length
      ? `${shortDay(date)} · ${times.slice(0, 3).join(", ")}${times.length > 3 ? " +more" : ""}`
      : e.event
        ? eventWhen(e, start ?? lagosToday(), end)
        : e.offer.hostIncluded
          ? "Local host included"
          : e.kind === "FULL_DAY"
            ? "Full day"
            : weeklyPattern(e);
  return (
    <article className="experience card tile" data-saved={saved}>
      <div className="tile-media card-media">
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
        {e.event && (
          <span className="media-badge">{eventTypeLabels[e.event.type]}</span>
        )}
        <span className="tile-save">
          <BucketButton id={e.offer.id} variant="icon" />
        </span>
      </div>
      <div className="tile-body">
        <p className="tile-meta">
          {categoryShortLabels[e.categoryId] ?? e.categoryId} ·{" "}
          {zoneLabel(e.zoneId)} ·{" "}
          {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)} ·{" "}
          {ageLabel(details)}
        </p>
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={name}
            triggerStyle="title"
          />
        </h3>
        {highlight && (
          <p className="tile-highlight" data-event={!!e.event || !!date}>
            {(e.event || date) && <Icon name="calendar" size={14} />}
            {highlight}
          </p>
        )}
        <p className="tile-price">
          <strong>{formatMoney(e.offer.rateMinor)}</strong>{" "}
          {priceBasisLabel(e.offer.priceBasis)}
        </p>
        {details.confirmation === "INSTANT" && (
          <p className="tile-flag">
            <Icon name="check" size={14} />
            Instant confirmation
          </p>
        )}
        {date && times.length > 0 && (
          <Link
            className="text-link tile-book"
            href={`/experiences/${e.seedKey ?? e.id}?date=${date}&book=1${visit ? `&from=${visit.from}&to=${visit.to}` : ""}`}
          >
            Book for {shortDay(date)}
            <Icon name="arrowRight" size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}

export type ExploreFilters = {
  category?: string;
  view?: string;
  date?: string;
  from?: string;
  to?: string;
  when?: string;
  price?: string;
  family?: string;
  arrival?: string;
  area?: string;
};

export default function CatalogueBrowser({
  records,
  initial = {},
  tripId,
  today,
}: {
  records: Record[];
  initial?: ExploreFilters;
  tripId?: string;
  today: string;
}) {
  const { ids } = useBucket();
  const activeTrip = useActiveTrip();
  const currentTrip = tripId || activeTrip;
  const [bucketOnly, setBucketOnly] = useState(initial.view === "bucket");
  // Small screens fold the refining controls behind a Filters button.
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState(initial.category ?? ""),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [accessible, setAccessible] = useState(false),
    // "", "weekend", a day, or "range" for the dates of a visit.
    [date, setDate] = useState(
      (initial.from && initial.to) || initial.when === "range"
        ? "range"
        : initial.date === "weekend" || isoDate.test(initial.date ?? "")
          ? initial.date!
          : "",
    ),
    [from, setFrom] = useState(
      isoDate.test(initial.from ?? "") ? initial.from! : "",
    ),
    [to, setTo] = useState(isoDate.test(initial.to ?? "") ? initial.to! : ""),
    [price, setPrice] = useState(initial.price ?? ""),
    [family, setFamily] = useState(initial.family === "1"),
    [arrival, setArrival] = useState(initial.arrival ?? ""),
    [area, setArea] = useState(initial.area ?? "");
  const weekend = weekendDates(today);
  const days =
    date === "range"
      ? rangeDays(from, to)
      : date === "weekend"
        ? weekend
        : date
          ? [date]
          : [];
  const visit = date === "range" && days.length ? { from, to } : undefined;
  // Keep the filters in the address so back, reload and sharing keep them.
  useEffect(() => {
    const query = new URLSearchParams(
      Object.entries({
        category,
        date: date === "range" ? "" : date,
        from: date === "range" ? from : "",
        to: date === "range" ? to : "",
        price,
        family: family ? "1" : "",
        arrival,
        area,
        view: bucketOnly ? "bucket" : "",
        trip: tripId ?? "",
      }).filter(([, value]) => value),
    ).toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [
    category,
    date,
    from,
    to,
    price,
    family,
    arrival,
    area,
    bucketOnly,
    tripId,
  ]);
  const activeFilters = [family, arrival, area, price, kind, accessible].filter(
    Boolean,
  ).length;
  const query = search.trim().toLowerCase();
  const filtering = !!(
    category ||
    query ||
    kind ||
    accessible ||
    days.length ||
    price ||
    family ||
    arrival ||
    area
  );
  const filtered = records.filter((e) => {
    const details = listingDetails(e);
    return (
      (!bucketOnly || ids.includes(e.offer.id)) &&
      // Dated events have their own row above; list them here only when the
      // traveller is filtering, searching or viewing their bucket.
      (filtering || bucketOnly || !isEvent(e)) &&
      (!days.length || days.some((d) => runsOn(e, d))) &&
      (!family || details.familySuitable) &&
      (!arrival ||
        (arrival === "SELF"
          ? details.arrival !== "PICKUP_REQUIRED"
          : details.arrival !== "SELF")) &&
      (!area || e.zoneId === area) &&
      inPriceBand(e.offer.rateMinor, price) &&
      (!category ||
        (category === "events" ? isEvent(e) : e.categoryId === category)) &&
      (!query ||
        displayName(e.name).toLowerCase().includes(query) ||
        storyFor(e.seedKey, e.categoryId)
          .teaser.toLowerCase()
          .includes(query) ||
        (categoryShortLabels[e.categoryId] ?? "")
          .toLowerCase()
          .includes(query) ||
        zoneLabel(e.zoneId).toLowerCase().includes(query)) &&
      (!kind || e.kind === kind) &&
      // Accessibility is unconfirmed for every listing; never relax this filter.
      !accessible
    );
  });
  function resetFilters() {
    setCategory("");
    setSearch("");
    setKind("");
    setAccessible(false);
    setDate("");
    setFrom("");
    setTo("");
    setPrice("");
    setFamily(false);
    setArrival("");
    setArea("");
  }
  function showBucket() {
    resetFilters();
    setBucketOnly(true);
    document.getElementById("results")?.scrollIntoView({ block: "start" });
  }
  return (
    <>
      <header className="explore-banner">
        <img
          className="explore-banner-image"
          src={banner.src}
          alt={banner.title}
          width={banner.width}
          height={banner.height}
        />
        <div className="explore-banner-inner">
          <p className="explore-banner-kicker">
            {defaultDestination.name}, Nigeria
          </p>
          <h1>Things to do in {defaultDestination.name}</h1>
          <div className="explore-banner-search">
            <label className="search-field explore-search">
              <Icon name="search" size={20} />
              <span className="sr-only">Search experiences</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search art, food, beach, Lekki…"
              />
            </label>
            {/* One date, or the visit fields below, never both. */}
            {date !== "range" && (
              <label className="explore-date-field">
                <Icon name="calendar" size={18} />
                <span className="sr-only">Pick a date</span>
                <input
                  type="date"
                  min={today}
                  value={isoDate.test(date) ? date : ""}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="chip-row date-chips" role="group" aria-label="When">
            <button
              type="button"
              className="chip"
              aria-pressed={!date}
              onClick={() => setDate("")}
            >
              Any date
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={date === today}
              onClick={() => setDate(today)}
            >
              Today
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={date === "weekend"}
              onClick={() => setDate("weekend")}
            >
              This weekend
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={date === "range"}
              aria-expanded={date === "range"}
              aria-controls="visit-dates"
              onClick={() => setDate("range")}
            >
              My dates
            </button>
          </div>
          {date === "range" && (
            <div className="visit-dates" id="visit-dates">
              <label className="field">
                <span>Here from</span>
                <input
                  type="date"
                  min={today}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (to && e.target.value > to) setTo(e.target.value);
                  }}
                />
              </label>
              <label className="field">
                <span>Until</span>
                <input
                  type="date"
                  min={from || today}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <p>
                {days.length
                  ? `Showing what runs during your ${days.length} ${days.length === 1 ? "day" : "days"}, including events.`
                  : "Add the dates you’re in Lagos to see what runs while you’re here."}
              </p>
            </div>
          )}
        </div>
        <p className="explore-banner-credit">
          Photo: {banner.author} / {banner.license}
        </p>
      </header>
      <Rail label="Categories" trackClassName="chip-row chip-track" compact>
        <button
          type="button"
          className="chip"
          aria-pressed={!category}
          onClick={() => setCategory("")}
        >
          All categories
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={category === "events"}
          onClick={() => setCategory("events")}
        >
          <Icon name="calendar" size={14} />
          Events
        </button>
        {categories.map((c) => (
          <button
            type="button"
            className="chip"
            key={c.id}
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </Rail>
      {!filtering && !bucketOnly && <WhatsOn records={records} />}
      <div className="results-bar" id="results">
        <div className="results-title">
          <h2>
            {bucketOnly
              ? "Your Bucket"
              : visit
                ? `During your dates: ${rangeText(from, to)}`
                : days.length && date !== "range"
                  ? `On ${days.map(shortDay).join(" or ")}`
                  : filtering
                    ? "Results"
                    : "All experiences"}
          </h2>
          <p aria-live="polite">
            <strong>
              {filtered.length}{" "}
              {filtered.length === 1 ? "experience" : "experiences"}
            </strong>
            {bucketOnly ? " in your Bucket" : ""}
            {filtering && (
              <button
                type="button"
                className="text-button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
        <div className="explore-toolbar">
          <div
            className="segmented segmented--small"
            role="group"
            aria-label="Show"
          >
            <button
              type="button"
              aria-pressed={!bucketOnly}
              onClick={() => setBucketOnly(false)}
            >
              All experiences
            </button>
            <button
              type="button"
              aria-pressed={bucketOnly}
              onClick={() => setBucketOnly(true)}
            >
              <Icon name="bookmark" size={16} />
              My Bucket <span className="count">{ids.length}</span>
            </button>
          </div>
          <button
            type="button"
            className="secondary filters-toggle"
            aria-expanded={showFilters}
            aria-controls="explore-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon name="layout" size={16} />
            Filters
            {activeFilters > 0 && (
              <span className="count">{activeFilters}</span>
            )}
            <Icon name="chevronDown" size={16} />
          </button>
          <div
            className="explore-filters"
            id="explore-filters"
            data-open={showFilters}
          >
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={family}
                onChange={(e) => setFamily(e.target.checked)}
              />
              Good for kids
            </label>
            <label className="select-field">
              <span className="sr-only">Getting there</span>
              <select
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              >
                <option value="">Getting there</option>
                <option value="SELF">I’ll make my own way</option>
                <option value="PICKUP">Pickup available</option>
              </select>
            </label>
            <label className="select-field">
              <span className="sr-only">Price</span>
              <select value={price} onChange={(e) => setPrice(e.target.value)}>
                <option value="">Any price</option>
                {priceBands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span className="sr-only">Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {defaultDestination.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span className="sr-only">Length</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Any length</option>
                <option value="MAIN">Main activities</option>
                <option value="LIGHT">Light activities</option>
                <option value="FULL_DAY">Full days</option>
              </select>
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(e) => setAccessible(e.target.checked)}
              />
              Wheelchair access
              <span className="sr-only"> (confirmed only)</span>
            </label>
          </div>
        </div>
        {bucketOnly && (
          <div className="results-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setBucketOnly(false)}
            >
              <Icon name="arrowLeft" size={16} />
              Keep exploring
            </button>
            <ClearBucket />
          </div>
        )}
      </div>
      {!filtered.length ? (
        <div className="empty-state">
          <Icon name={bucketOnly ? "bookmark" : "search"} size={28} />
          <h2>
            {bucketOnly && !ids.length
              ? "Your Bucket is empty"
              : accessible
                ? "No confirmed wheelchair access yet"
                : "Nothing matches those filters"}
          </h2>
          <p>
            {bucketOnly && !ids.length
              ? "Save ideas as you browse. Saving doesn’t hold a date or book anything."
              : accessible
                ? "We only show access we have confirmed, and none of these experiences are confirmed yet. We won’t relax this filter for you."
                : days.length
                  ? "Nothing runs then with these filters. Try another date or clear filters."
                  : "Try a different category or search term."}
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              resetFilters();
              setBucketOnly(false);
            }}
          >
            Browse all experiences
          </button>
        </div>
      ) : (
        <div className="experience-grid">
          {filtered.map((e) => (
            <ExperienceCard
              key={e.id}
              experience={e}
              date={days.find((d) => runsOn(e, d))}
              visit={visit}
            />
          ))}
        </div>
      )}
      <BucketTray tripId={currentTrip} onView={showBucket} />
    </>
  );
}
