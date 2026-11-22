"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  inclusionLabels,
  inclusionStatusLabels,
  inclusionStatuses,
  packageEditSchema,
  packagePriceBases,
  packageReadiness,
  packageStatuses,
  seatLabels,
  seatStates,
  type PackageRecord,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import { addDays } from "@/modules/catalogue/domain/schedule";
import { lagosToday } from "@/modules/catalogue/domain/events";
import { knownTags } from "@/modules/catalogue/domain/tags";
import { Choice, Lines, Money, Num } from "./admin-listing-form";
import TagPicker from "./admin-tag-picker";
import PackageCard from "./package-card";

type Draft = {
  id: string;
  expectedVersion: number;
  status: PackageRecord["status"];
  trip: TripPackage & { tags: NonNullable<TripPackage["tags"]> };
};

const sections = [
  { id: "basics", label: "Basics" },
  { id: "route", label: "Route" },
  { id: "departures", label: "Departures" },
  { id: "pricing", label: "Pricing" },
  { id: "included", label: "What's included" },
  { id: "publish", label: "Terms & publish" },
] as const;
type SectionId = (typeof sections)[number]["id"];

const statusNames: Record<string, string> = {
  DRAFT: "Draft",
  DEMO_PUBLISHED: "Published",
  PAUSED: "Unpublished",
};
const statusHints: Record<string, string> = {
  DRAFT: "Draft: not visible to travellers.",
  DEMO_PUBLISHED: "Published: listed under Ready-made trips and bookable.",
  PAUSED: "Unpublished: hidden; carts that hold it show it as unavailable.",
};

function draftOf(row: PackageRecord): Draft {
  return {
    id: row.id,
    expectedVersion: row.version,
    status: row.status,
    trip: { ...row.record, tags: knownTags(row.record.tags) },
  };
}

// Drops blank terms, renumbers days and sorts departures before saving.
function cleanTrip(trip: Draft["trip"]): TripPackage {
  return {
    ...trip,
    route: trip.route.map((r, i) => ({ ...r, day: i + 1 })),
    departures: [...trip.departures].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    bookingTerms: trip.bookingTerms.map((t) => t.trim()).filter(Boolean),
  };
}

function TripForm({
  trip,
  set,
  section,
}: {
  trip: Draft["trip"];
  set: (patch: Partial<Draft["trip"]>) => void;
  section: SectionId;
}) {
  const today = lagosToday();
  switch (section) {
    case "basics":
      return (
        <>
          <label>
            Title
            <input
              required
              maxLength={120}
              value={trip.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <small className="form-hint">
              Web address: /packages/{trip.slug}. It stays the same when you
              rename the trip.
            </small>
          </label>
          <label>
            Summary
            <textarea
              rows={3}
              maxLength={400}
              value={trip.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
            <small className="form-hint">
              Two sentences on the trip, shown on the card and the trip page.
            </small>
          </label>
          <div className="field-grid">
            <label>
              Operator
              <input
                maxLength={120}
                value={trip.operator}
                onChange={(e) => set({ operator: e.target.value })}
              />
            </label>
            <label>
              Starts in
              <input
                maxLength={60}
                value={trip.startCity}
                onChange={(e) => set({ startCity: e.target.value })}
              />
              <small className="form-hint">
                Also lists the trip on that city’s page.
              </small>
            </label>
          </div>
          <label>
            About the operator
            <textarea
              rows={2}
              maxLength={300}
              value={trip.operatorNote}
              onChange={(e) => set({ operatorNote: e.target.value })}
            />
            <small className="form-hint">
              Licences and what they handle, such as hotels or park permits.
            </small>
          </label>
          <TagPicker value={trip.tags} onChange={(tags) => set({ tags })} />
        </>
      );
    case "route":
      return (
        <>
          <ol className="admin-route">
            {trip.route.map((r, i) => {
              const update = (patch: Partial<typeof r>) =>
                set({
                  route: trip.route.map((x, j) =>
                    j === i ? { ...x, ...patch } : x,
                  ),
                });
              const move = (by: number) => {
                const route = [...trip.route];
                [route[i], route[i + by]] = [route[i + by], route[i]];
                set({ route });
              };
              return (
                <li key={i} className="admin-route-day">
                  <h3>Day {i + 1}</h3>
                  <label>
                    Place
                    <input
                      maxLength={120}
                      placeholder="Calabar → Obudu"
                      value={r.place}
                      onChange={(e) => update({ place: e.target.value })}
                    />
                  </label>
                  <label>
                    Plan for the day
                    <textarea
                      rows={2}
                      maxLength={400}
                      value={r.plan}
                      onChange={(e) => update({ plan: e.target.value })}
                    />
                  </label>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={i === 0}
                      onClick={() => move(-1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={i === trip.route.length - 1}
                      onClick={() => move(1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={trip.route.length === 1}
                      onClick={() =>
                        set({
                          route: trip.route.filter((_, j) => j !== i),
                          nights: Math.min(trip.nights, trip.route.length - 1),
                        })
                      }
                    >
                      Remove day
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="secondary admin-add"
            disabled={trip.route.length >= 31}
            onClick={() =>
              set({
                route: [
                  ...trip.route,
                  { day: trip.route.length + 1, place: "", plan: "" },
                ],
                // Keep nights in step when they matched the old length.
                nights:
                  trip.nights === trip.route.length - 1
                    ? trip.route.length
                    : trip.nights,
              })
            }
          >
            Add day
          </button>
          <Num
            label="Nights"
            min={0}
            max={trip.route.length}
            value={trip.nights}
            onChange={(nights) => set({ nights })}
            hint={`${trip.route.length} days. Usually one night fewer than days.`}
          />
        </>
      );
    case "departures":
      return (
        <>
          {trip.departures.length === 0 && (
            <p className="muted">No departures yet.</p>
          )}
          <ul className="admin-departures">
            {trip.departures.map((d, i) => {
              const update = (patch: Partial<typeof d>) =>
                set({
                  departures: trip.departures.map((x, j) =>
                    j === i ? { ...x, ...patch } : x,
                  ),
                });
              return (
                <li key={i} className="admin-departure">
                  <label>
                    Departs
                    <input
                      type="date"
                      required
                      value={d.date}
                      onChange={(e) => update({ date: e.target.value })}
                    />
                    {d.date < today && (
                      <small className="form-hint">
                        In the past: hidden from travellers.
                      </small>
                    )}
                  </label>
                  <Choice
                    label="Seats"
                    value={d.seats}
                    options={seatStates}
                    labels={seatLabels}
                    onChange={(seats) => update({ seats })}
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      set({
                        departures: trip.departures.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="secondary admin-add"
            disabled={trip.departures.length >= 30}
            onClick={() => {
              const last = [...trip.departures].sort((a, b) =>
                b.date.localeCompare(a.date),
              )[0]?.date;
              set({
                departures: [
                  ...trip.departures,
                  {
                    date: addDays(last && last >= today ? last : today, 14),
                    seats: "OPEN",
                  },
                ],
              });
            }}
          >
            Add departure
          </button>
        </>
      );
    case "pricing":
      return (
        <div className="field-grid">
          <Choice
            label="Price basis"
            value={trip.priceBasis}
            options={packagePriceBases}
            labels={{
              PER_PERSON_TWIN: "Per person, sharing a room",
              PER_PERSON: "Per person",
            }}
            onChange={(priceBasis) => set({ priceBasis })}
          />
          <Money
            label="Price (₦)"
            value={trip.priceMinor}
            onChange={(priceMinor) => set({ priceMinor })}
          />
          <Money
            label="Single room supplement (₦)"
            value={trip.singleSupplementMinor}
            onChange={(singleSupplementMinor) => set({ singleSupplementMinor })}
            hint="Per room, for the whole trip. 0 if not offered."
          />
        </div>
      );
    case "included":
      return (
        <div className="admin-inclusions">
          {trip.inclusions.map((inc, i) => {
            const update = (patch: Partial<typeof inc>) =>
              set({
                inclusions: trip.inclusions.map((x, j) =>
                  j === i ? { ...x, ...patch } : x,
                ),
              });
            return (
              <div key={inc.item} className="admin-inclusion">
                <Choice
                  label={inclusionLabels[inc.item]}
                  value={inc.status}
                  options={inclusionStatuses}
                  labels={inclusionStatusLabels}
                  onChange={(status) => update({ status })}
                />
                <label>
                  Details
                  <input
                    maxLength={200}
                    placeholder="For example: 2 nights at the ranch resort"
                    value={inc.detail}
                    onChange={(e) => update({ detail: e.target.value })}
                  />
                </label>
              </div>
            );
          })}
        </div>
      );
    case "publish": {
      const missing = packageReadiness(cleanTrip(trip), today);
      return (
        <>
          <Lines
            label="Booking terms"
            value={trip.bookingTerms}
            onChange={(bookingTerms) => set({ bookingTerms })}
            hint="One per line: payment, refunds by days before departure, and changes the operator may make."
          />
          <div className="admin-readiness">
            <h3>Ready to publish?</h3>
            {missing.length ? (
              <ul>
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p>Everything travellers need is filled in.</p>
            )}
          </div>
          <div className="admin-package-preview" aria-label="Customer preview">
            <p className="eyebrow">Customer preview</p>
            <PackageCard p={cleanTrip(trip)} />
          </div>
        </>
      );
    }
  }
}

export default function AdminPackages() {
  const [rows, setRows] = useState<PackageRecord[]>([]),
    [edit, setEdit] = useState<Draft | null>(null),
    [baseline, setBaseline] = useState(""),
    [section, setSection] = useState<SectionId>("basics"),
    [status, setStatus] = useState("Loading trips…"),
    [problems, setProblems] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(""),
    [createError, setCreateError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL");
  const dirty = !!edit && JSON.stringify(edit) !== baseline;
  const current = rows.find((r) => r.id === edit?.id);
  const editor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/packages")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (active) {
          setRows(body.data);
          setStatus(`${body.data.length} trips loaded.`);
        }
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function show(row: PackageRecord, message: string) {
    const next = draftOf(row);
    setEdit(next);
    setBaseline(JSON.stringify(next));
    setProblems([]);
    setStatus(message);
    editor.current?.focus();
  }
  function open(row: PackageRecord) {
    if (dirty && !window.confirm("Discard unsaved changes to this trip?"))
      return;
    setSection("basics");
    show(row, "Editing trip.");
  }
  function set(patch: Partial<Draft["trip"]>) {
    setEdit((e) => (e ? { ...e, trip: { ...e.trip, ...patch } } : e));
  }

  async function save(change?: "PUBLISH" | "UNPUBLISH") {
    if (!edit) return;
    const trip = cleanTrip(edit.trip);
    const parsed = packageEditSchema.safeParse({
      id: edit.id,
      expectedVersion: edit.expectedVersion,
      status:
        change === "PUBLISH"
          ? "DEMO_PUBLISHED"
          : change === "UNPUBLISH"
            ? "PAUSED"
            : edit.status,
      trip,
    });
    const missing =
      parsed.success && parsed.data.status === "DEMO_PUBLISHED"
        ? packageReadiness(trip, lagosToday())
        : [];
    if (!parsed.success || missing.length) {
      setProblems(
        parsed.success
          ? missing
          : parsed.error.issues.map((i) =>
              i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message,
            ),
      );
      setStatus(
        change === "PUBLISH"
          ? "Not ready to publish yet. Fix the items below."
          : "Fix the problems below, then save again.",
      );
      return;
    }
    setProblems([]);
    setBusy(true);
    try {
      const r = await fetch("/api/v1/admin/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error.message);
      setRows((rows) =>
        rows.map((row) => (row.id === body.data.id ? body.data : row)),
      );
      show(
        body.data,
        change === "PUBLISH"
          ? "Published. Travellers can see and book it now."
          : change === "UNPUBLISH"
            ? "Unpublished. Hidden from travellers."
            : `Saved version ${body.data.version}.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const shown = rows.filter(
    (r) =>
      (filter === "ALL" || r.status === filter) &&
      (!query ||
        `${r.record.title} ${r.record.operator} ${r.slug}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  return (
    <div className="admin-layout">
      <aside className="card admin-library">
        <div className="admin-library-tools">
          <h2 id="admin-packages-heading">Ready-made trips</h2>
          <details className="admin-create">
            <summary>Create trip</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  dirty &&
                  !window.confirm("Discard unsaved changes to this trip?")
                )
                  return;
                setCreateError("");
                setBusy(true);
                try {
                  const r = await fetch("/api/v1/admin/packages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title }),
                  });
                  const body = await r.json();
                  if (!r.ok) throw Error(body.error.message);
                  setRows((rows) => [body.data, ...rows]);
                  setSection("basics");
                  setTitle("");
                  show(
                    body.data,
                    "Draft created. Fill in each section, then publish.",
                  );
                } catch (e) {
                  setCreateError(
                    e instanceof Error ? e.message : "Unable to create trip.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Trip title
                <input
                  required
                  minLength={5}
                  maxLength={120}
                  placeholder="3 days in Obudu Mountains"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <button disabled={busy}>Create draft</button>
              {createError && (
                <p className="field-error" role="alert">
                  {createError}
                </p>
              )}
            </form>
          </details>
          <label>
            Search trips
            <input
              type="search"
              placeholder="Title, operator or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="admin-filters" role="group" aria-label="Status">
            {["ALL", ...packageStatuses].map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
              >
                {s === "ALL" ? "All" : statusNames[s]}{" "}
                {s === "ALL"
                  ? rows.length
                  : rows.filter((r) => r.status === s).length}
              </button>
            ))}
          </div>
        </div>
        <div className="catalogue-list" aria-label="Trip results">
          {shown.map((row) => (
            <button
              className="secondary"
              key={row.id}
              disabled={busy}
              aria-pressed={edit?.id === row.id}
              onClick={() => open(row)}
            >
              <span>{row.record.title}</span>
              <small>
                <span className="status-dot" data-status={row.status} />
                {statusNames[row.status] ?? row.status} ·{" "}
                {row.record.route.length} days
              </small>
            </button>
          ))}
          {!shown.length && <p className="muted">No trips match.</p>}
        </div>
      </aside>
      <div
        className="card admin-editor"
        ref={editor}
        tabIndex={-1}
        role="region"
        aria-label="Trip editor"
      >
        {edit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            noValidate
          >
            <div className="admin-editor-top">
              <a
                href="#admin-packages-heading"
                className="text-link admin-back"
              >
                Back to trips
              </a>
              <div className="admin-editor-head">
                <div>
                  <h2>{edit.trip.title}</h2>
                  <p className="muted">
                    <span
                      className="status-dot"
                      data-status={current?.status}
                    />
                    {statusHints[current?.status ?? edit.status]}
                  </p>
                </div>
                {current?.status === "DEMO_PUBLISHED" && (
                  <Link
                    className="text-link"
                    href={`/packages/${current.slug}`}
                    target="_blank"
                  >
                    View live trip
                  </Link>
                )}
              </div>
              <nav className="admin-tabs" aria-label="Trip sections">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="chip"
                    aria-pressed={section === s.id}
                    onClick={() => setSection(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
            <fieldset className="admin-editor-fields" disabled={busy}>
              <TripForm trip={edit.trip} set={set} section={section} />
            </fieldset>
            {problems.length > 0 && (
              <ul className="field-error admin-problems" role="alert">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <div className="admin-savebar">
              <p role="status" className="muted">
                {dirty ? "Unsaved changes. " : ""}
                {status}
              </p>
              <div className="admin-save-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!dirty || busy}
                  onClick={() => {
                    setEdit(JSON.parse(baseline));
                    setProblems([]);
                  }}
                >
                  Discard
                </button>
                <button className="secondary" disabled={!dirty || busy}>
                  Save changes
                </button>
                {current?.status === "DEMO_PUBLISHED" ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => save("UNPUBLISH")}
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save("PUBLISH")}
                  >
                    {dirty ? "Save & publish" : "Publish"}
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="admin-editor-empty">
            <h2>Choose a trip to edit</h2>
            <p className="muted">
              Ready-made trips are multi-day getaways run by partner operators,
              such as three days in Obudu. Create one, fill in each section and
              publish it.
            </p>
            <p role="status" className="muted">
              {status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
