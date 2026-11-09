"use client";
import { useState } from "react";
import Link from "next/link";
import { BucketButton, BucketTray, ClearBucket } from "./bucket";
import { useBucket } from "@/hooks/use-bucket";
import { useActiveTrip } from "@/hooks/use-active-trip";
import { useTripDates } from "@/hooks/use-trip-dates";
import { photoById } from "@/modules/catalogue/domain/photos";
import { WhatsOn, rangeLabel } from "./whats-on";
import ExperienceOverlay from "./experience-overlay";
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
export function money(n: number) {
  return formatMoney(n);
}
type Record = Experience & { seedKey: string };
const banner = photoById("lekki-link-bridge");

// One calm card for every listing: photo, a quiet meta line, the name, at
// most one highlight and the price. The bucket toggle sits on the photo.
export function ExperienceCard({
  experience: e,
  start,
  end,
}: {
  experience: Experience & { seedKey?: string };
  // Dated events show their first date inside this window.
  start?: string;
  end?: string;
}) {
  const { ids } = useBucket();
  const saved = ids.includes(e.offer.id);
  const name = displayName(e.name);
  const highlight = e.event
    ? eventWhen(e, start ?? lagosToday(), end)
    : e.offer.hostIncluded
      ? "Local host included"
      : e.kind === "FULL_DAY"
        ? "Full day"
        : undefined;
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
          {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}
        </p>
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={name}
            triggerStyle="title"
          />
        </h3>
        {highlight && (
          <p className="tile-highlight" data-event={!!e.event}>
            {e.event && <Icon name="calendar" size={14} />}
            {highlight}
          </p>
        )}
        <p className="tile-price">
          <strong>{formatMoney(e.offer.rateMinor)}</strong>{" "}
          {priceBasisLabel(e.offer.priceBasis)}
        </p>
      </div>
    </article>
  );
}

export default function CatalogueBrowser({
  records,
  initialCategory = "",
  initialView = "all",
  tripId,
}: {
  records: Record[];
  initialCategory?: string;
  initialView?: string;
  tripId?: string;
}) {
  const { ids } = useBucket();
  const activeTrip = useActiveTrip();
  const currentTrip = tripId || activeTrip;
  const [bucketOnly, setBucketOnly] = useState(initialView === "bucket");
  const [category, setCategory] = useState(initialCategory),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [accessible, setAccessible] = useState(false);
  const query = search.trim().toLowerCase();
  const filtering = !!(category || query || kind || accessible);
  const filtered = records.filter(
    (e) =>
      (!bucketOnly || ids.includes(e.offer.id)) &&
      // Dated events have their own row above; list them here only when the
      // traveller is filtering, searching or viewing their bucket.
      (filtering || bucketOnly || !isEvent(e)) &&
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
      !accessible,
  );
  function resetFilters() {
    setCategory("");
    setSearch("");
    setKind("");
    setAccessible(false);
  }
  const dates = useTripDates();
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
          <p className="explore-banner-kicker">Explore Lagos</p>
          <h1>Things to do in Lagos</h1>
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
            <Link
              className="explore-dates"
              href={
                currentTrip
                  ? `/trips/${encodeURIComponent(currentTrip)}/profile`
                  : "/plan/new?mode=form"
              }
            >
              <Icon name="calendar" size={18} />
              {dates ? rangeLabel(dates.start, dates.end) : "Add your dates"}
            </Link>
          </div>
        </div>
        <p className="explore-banner-credit">
          Photo: {banner.author} / {banner.license}
        </p>
      </header>
      <div className="chip-row" role="group" aria-label="Category">
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
          What’s on
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
      </div>
      {!filtering && !bucketOnly && <WhatsOn records={records} />}
      <div className="results-bar" id="results">
        <div className="results-title">
          <h2>
            {bucketOnly
              ? "Your bucket"
              : filtering
                ? "Results"
                : "All experiences"}
          </h2>
          <p aria-live="polite">
            <strong>
              {filtered.length}{" "}
              {filtered.length === 1 ? "experience" : "experiences"}
            </strong>
            {bucketOnly ? " in your bucket" : ""}
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
            Confirmed wheelchair access
          </label>
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
              ? "Your bucket is empty"
              : accessible
                ? "No confirmed wheelchair access yet"
                : "Nothing matches those filters"}
          </h2>
          <p>
            {bucketOnly && !ids.length
              ? "Add experiences you like as you browse. They’ll be waiting in your planner."
              : accessible
                ? "We only show access we have confirmed, and none of these experiences are confirmed yet. We won’t relax this filter for you."
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
            <ExperienceCard key={e.id} experience={e} />
          ))}
        </div>
      )}
      <BucketTray tripId={currentTrip} onView={showBucket} />
    </>
  );
}
