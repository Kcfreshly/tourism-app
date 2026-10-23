"use client";
import { useState } from "react";
import { BucketButton, PlanTrip, useBucket } from "./bucket";
import Link from "next/link";
import { useActiveTrip } from "./trip-store";
import ExperienceOverlay from "./experience-overlay";
import categories from "../../tourism-v1-handoff/data/categories.json";
import type { Experience } from "@/server/catalogue";
export function money(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n / 100);
}
export default function CatalogueBrowser({
  records,
  initialCategory = "",
  tripId,
}: {
  records: (Experience & { seedKey: string })[];
  initialCategory?: string;
  tripId?: string;
}) {
  const { ids } = useBucket();
  const activeTrip = useActiveTrip();
  const currentTrip = tripId || activeTrip;
  const [bucketOnly, setBucketOnly] = useState(false);
  const [category, setCategory] = useState(initialCategory),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [accessible, setAccessible] = useState(false);
  const filtered = records.filter(
    (e) =>
      (!bucketOnly || ids.includes(e.offer.id)) &&
      (!category || e.categoryId === category) &&
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (!kind || e.kind === kind) &&
      !accessible,
  );
  return (
    <>
      <div className="explore-journey card">
        <div>
          <p className="eyebrow">
            {currentTrip
              ? "YOUR DRAFT IS READY TO PERSONALISE"
              : "COLLECT IDEAS BEFORE YOU PLAN"}
          </p>
          <h2>Save now. Plan your days next.</h2>
          <p>
            <strong>Add to bucket</strong> saves an idea. It doesn&apos;t book
            it or choose a time. In your planner, <strong>My Bucket</strong>{" "}
            shows your shortlist; <strong>All Experiences</strong> opens the
            full catalogue.
          </p>
        </div>
        <div className="explore-journey-actions">
          <PlanTrip tripId={currentTrip} />
          <Link href="/trips">My trip drafts</Link>
        </div>
      </div>
      <div className="catalogue-toolbar">
        <div className="chips">
          <button
            aria-pressed={!bucketOnly}
            onClick={() => setBucketOnly(false)}
          >
            All experiences
          </button>
          <button aria-pressed={bucketOnly} onClick={() => setBucketOnly(true)}>
            My Bucket ({ids.length})
          </button>
        </div>
        <p className="muted">Your bucket follows you into the planner.</p>
      </div>
      <div className="filters">
        <label>
          Search experiences
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nature, art, local life…"
          />
        </label>
        <label>
          Day shape
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All durations</option>
            <option>MAIN</option>
            <option>LIGHT</option>
            <option>FULL_DAY</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={accessible}
            onChange={(e) => setAccessible(e.target.checked)}
          />
          Confirmed wheelchair access only
        </label>
      </div>
      <div className="chips">
        <button aria-pressed={!category} onClick={() => setCategory("")}>
          All experiences
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="muted">
        {filtered.length} fictional experiences · transport priced separately ·
        accessibility unconfirmed
      </p>
      {!filtered.length ? (
        <div className="card">
          <h2>No matching experiences</h2>
          <p>
            Your accessibility preference has not been relaxed. Demo
            accessibility is unconfirmed.
          </p>
          <button
            onClick={() => {
              setCategory("");
              setSearch("");
              setKind("");
              setAccessible(false);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="experience-grid">
          {filtered.map((e) => (
            <article
              className="experience card"
              data-saved={ids.includes(e.offer.id)}
              key={e.id}
            >
              <ExperienceOverlay
                experience={e}
                triggerStyle="image"
                trigger={
                  <img
                    src={e.imagePath}
                    loading="lazy"
                    alt={e.inspirationPhoto?.title ?? `View ${e.name}`}
                  />
                }
              />
              <div className="card-body">
                <p className="eyebrow">
                  {e.zoneId} · {e.kind.replace("_", " ")}
                </p>
                <h3>
                  <ExperienceOverlay
                    experience={e}
                    trigger={e.name}
                    triggerStyle="title"
                  />
                </h3>
                <p>
                  {e.durationMinMinutes}–{e.durationMaxMinutes} min ·
                  verification: demo only
                </p>
                <strong>
                  {money(e.offer.rateMinor)}{" "}
                  <small>
                    / {e.offer.priceBasis === "PER_ADULT" ? "adult" : "group"}
                  </small>
                </strong>
                <div className="experience-actions">
                  <BucketButton id={e.offer.id} />
                  <ExperienceOverlay experience={e} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
