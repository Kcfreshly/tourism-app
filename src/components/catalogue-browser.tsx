"use client";
import { useState } from "react";
import { BucketButton, BucketTray, ClearBucket, useBucket } from "./bucket";
import { useActiveTrip } from "./trip-store";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";
import categories from "../../tourism-v1-handoff/data/categories.json";
import type { Experience } from "@/server/catalogue";
import {
  categoryShortLabels,
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  storyFor,
  zoneLabel,
} from "@/domain/experience-content";
export function money(n: number) {
  return formatMoney(n);
}
type Record = Experience & { seedKey: string };

export function ExperienceCard({ experience: e }: { experience: Record }) {
  const { ids } = useBucket();
  const saved = ids.includes(e.offer.id);
  const name = displayName(e.name);
  return (
    <article className="experience card" data-saved={saved}>
      <div className="card-media">
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
        <span className="media-badge">
          {categoryShortLabels[e.categoryId] ?? e.categoryId}
        </span>
        {saved && (
          <span className="saved-flag">
            <Icon name="bookmarkFilled" size={14} />
            Saved
          </span>
        )}
      </div>
      <div className="card-body">
        <p className="card-meta">
          <span>
            <Icon name="pin" size={15} />
            {zoneLabel(e.zoneId)}
          </span>
          <span>
            <Icon name="clock" size={15} />
            {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}
          </span>
        </p>
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={name}
            triggerStyle="title"
          />
        </h3>
        <p className="card-teaser">
          {storyFor(e.seedKey, e.categoryId).teaser}
        </p>
        <ul className="card-tags" aria-label="Good to know">
          <li data-tone={e.schedulingType === "FIXED" ? "clay" : undefined}>
            {e.schedulingType === "FIXED"
              ? "Set sessions"
              : e.kind === "FULL_DAY"
                ? "Full day"
                : "Flexible start"}
          </li>
          {e.offer.hostIncluded && <li>Local host</li>}
          {e.kind === "LIGHT" && <li>Light activity</li>}
        </ul>
        <div className="card-footer">
          <p className="card-price">
            <strong>{formatMoney(e.offer.rateMinor)}</strong>
            <span>{priceBasisLabel(e.offer.priceBasis)}</span>
          </p>
          <BucketButton id={e.offer.id} variant="compact" />
        </div>
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
  const filtered = records.filter(
    (e) =>
      (!bucketOnly || ids.includes(e.offer.id)) &&
      (!category || e.categoryId === category) &&
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
  const filtering = !!(category || query || kind || accessible);
  function resetFilters() {
    setCategory("");
    setSearch("");
    setKind("");
    setAccessible(false);
  }
  function showBucket() {
    resetFilters();
    setBucketOnly(true);
    document.getElementById("results")?.scrollIntoView({ block: "start" });
  }
  return (
    <>
      <div className="explore-toolbar">
        <div className="segmented" role="group" aria-label="Show">
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
        <label className="search-field">
          <Icon name="search" size={18} />
          <span className="sr-only">Search experiences</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search art, food, beach, Lekki…"
          />
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
          Confirmed wheelchair access
        </label>
      </div>
      <div className="chip-row" role="group" aria-label="Category">
        <button
          type="button"
          className="chip"
          aria-pressed={!category}
          onClick={() => setCategory("")}
        >
          All categories
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
      <div className="results-bar" id="results">
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
