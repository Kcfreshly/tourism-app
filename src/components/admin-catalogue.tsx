"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  catalogueEditSchema,
  emptyReview,
  listingStatuses,
} from "@/modules/catalogue/domain/catalogue";
import {
  toPublishedExperience,
  type CatalogueRecord,
  type Experience,
} from "@/modules/catalogue/domain/experience";
import {
  displayName,
  storyFor,
} from "@/modules/catalogue/domain/experience-content";
import { listingDetails } from "@/modules/catalogue/domain/listing-details";
import { returnRideFor } from "@/modules/catalogue/domain/return-ride";
import ListingForm, {
  sections,
  type Edit,
  type FullEdit,
  type SectionId,
} from "./admin-listing-form";

type Row = Omit<CatalogueRecord, "record" | "review"> & {
  record: Experience;
  review: Edit["review"] | null;
};

// The editor starts from what travellers see today, including sample copy and
// derived sessions, so saving a listing stores its effective values.
function editRow(row: Row): FullEdit {
  const r = row.record;
  const live = toPublishedExperience(row);
  const details = listingDetails(live);
  return {
    id: row.id,
    expectedVersion: row.version,
    name: r.name,
    categoryId: r.categoryId as Edit["categoryId"],
    zoneId: r.zoneId as Edit["zoneId"],
    kind: r.kind as Edit["kind"],
    durationMinMinutes: r.durationMinMinutes,
    durationMaxMinutes: r.durationMaxMinutes,
    rateMinor: r.offer.rateMinor,
    capacityPerSlot: r.offer.capacityPerSlot,
    bookingCutoffHours: r.offer.bookingCutoffHours,
    returnRide: returnRideFor({ ...r, seedKey: row.seedKey }),
    status: row.status as Edit["status"],
    review: row.review ?? emptyReview,
    story: storyFor(live),
    tags: r.tags,
    priceBasis: r.offer.priceBasis as Edit["priceBasis"],
    capacityUnit: r.offer.capacityUnit as Edit["capacityUnit"],
    minParty: r.offer.minParty,
    maxParty: r.offer.maxParty,
    minAge: details.minAge,
    hostIncluded: r.offer.hostIncluded,
    details: {
      operator: details.operator,
      venue: details.venue,
      arrival: details.arrival,
      pickupRateMinor: details.pickupRateMinor,
      childRateMinor: details.childRateMinor,
      confirmation: details.confirmation,
      partnerHours: details.partnerHours,
      freeCancellationHours: details.freeCancellationHours,
    },
    availability: r.availabilityLocal,
    schedulingType: live.schedulingType,
    sessions: live.sessions ?? [],
    unavailableDates: r.unavailableDates ?? [],
    mobility: r.mobility as FullEdit["mobility"],
    inclusions: r.inclusions,
    exclusions: r.exclusions,
    photoId: r.photoId ?? "",
    videoUrl: r.videoUrl ?? "",
    event: r.event ?? null,
  };
}

const tidy = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

// Drops blank lines and empty optional text before validation.
function cleanEdit(edit: FullEdit): Edit {
  const fixed = edit.schedulingType === "FIXED" || !!edit.event;
  return {
    ...edit,
    tags: tidy(edit.tags),
    inclusions: tidy(edit.inclusions),
    exclusions: tidy(edit.exclusions),
    unavailableDates: tidy(edit.unavailableDates),
    sessions: fixed
      ? edit.sessions.map((s) => {
          const dates = s.dates ? tidy(s.dates) : [];
          return { ...s, dates: dates.length ? dates : undefined };
        })
      : [],
    event: edit.event && {
      type: edit.event.type,
      guaranteed: edit.event.guaranteed?.trim() || undefined,
      bonus: edit.event.bonus?.trim() || undefined,
    },
  };
}

function statusLabel(status: string) {
  return status.replace("DEMO_", "").replace("_", " ").toLowerCase();
}

export default function AdminCatalogue() {
  const [rows, setRows] = useState<Row[]>([]),
    [edit, setEdit] = useState<FullEdit | null>(null),
    [baseline, setBaseline] = useState(""),
    [section, setSection] = useState<SectionId>("basics"),
    [status, setStatus] = useState("Loading catalogue…"),
    [problems, setProblems] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL");
  const dirty = !!edit && JSON.stringify(edit) !== baseline;
  const current = rows.find((r) => r.id === edit?.id);

  async function load() {
    const r = await fetch("/api/v1/admin/catalogue");
    const body = await r.json();
    if (!r.ok) throw Error(body.error.message);
    setRows(body.data);
    setStatus(`${body.data.length} fictional records loaded.`);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/catalogue")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (active) {
          setRows(body.data);
          setStatus(`${body.data.length} fictional records loaded.`);
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

  function open(row: Row) {
    if (dirty && !window.confirm("Discard unsaved changes to this listing?"))
      return;
    const next = editRow(row);
    setEdit(next);
    setBaseline(JSON.stringify(next));
    setProblems([]);
    setStatus("Editing local demo supply.");
  }
  function set(patch: Partial<FullEdit>) {
    setEdit((e) => (e ? { ...e, ...patch } : e));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const parsed = catalogueEditSchema.safeParse(cleanEdit(edit));
    if (!parsed.success) {
      setProblems(
        parsed.error.issues.map((i) =>
          i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message,
        ),
      );
      setStatus("Fix the problems below, then save again.");
      return;
    }
    setProblems([]);
    setBusy(true);
    try {
      const r = await fetch("/api/v1/admin/catalogue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error.message);
      setRows((rows) =>
        rows.map((row) => (row.id === body.data.id ? body.data : row)),
      );
      const next = editRow(body.data);
      setEdit(next);
      setBaseline(JSON.stringify(next));
      setStatus(`Saved version ${body.data.version}. Audit recorded.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(
    () =>
      Object.fromEntries(
        listingStatuses.map((s) => [
          s,
          rows.filter((r) => r.status === s).length,
        ]),
      ),
    [rows],
  );
  const shown = rows.filter(
    (r) =>
      (filter === "ALL" || r.status === filter) &&
      (!query ||
        r.record.name.toLowerCase().includes(query.toLowerCase()) ||
        r.seedKey.includes(query.toLowerCase())),
  );

  return (
    <div className="admin-layout">
      <aside className="card card-body">
        <h2>Listings</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch("/api/v1/admin/catalogue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              const body = await r.json();
              if (!r.ok) throw Error(body.error.message);
              setRows((rows) => [body.data, ...rows]);
              const next = editRow(body.data);
              setEdit(next);
              setBaseline(JSON.stringify(next));
              setSection("basics");
              setName("");
              setStatus("Fictional draft created.");
            } catch (e) {
              setStatus(
                e instanceof Error ? e.message : "Unable to create draft.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New fictional draft name
            <input
              required
              minLength={5}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button disabled={busy}>Create draft</button>
        </form>
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="admin-filters" role="group" aria-label="Status">
          {["ALL", ...listingStatuses].map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
            >
              {s === "ALL"
                ? `All ${rows.length}`
                : `${statusLabel(s)} ${counts[s]}`}
            </button>
          ))}
        </div>
        <div className="catalogue-list">
          {shown.map((row) => (
            <button
              className="secondary"
              key={row.id}
              aria-pressed={edit?.id === row.id}
              onClick={() => open(row)}
            >
              <span>{displayName(row.record.name)}</span>
              <small>
                <span className="status-dot" data-status={row.status} />
                {statusLabel(row.status)} · v{row.version}
                {row.record.event ? " · event" : ""}
              </small>
            </button>
          ))}
          {!shown.length && <p className="muted">No listings match.</p>}
        </div>
      </aside>
      <div className="card form-card">
        {edit ? (
          <form onSubmit={save} noValidate>
            <div className="admin-editor-head">
              <div>
                <h2>{displayName(edit.name)}</h2>
                <p className="muted">
                  <span className="status-dot" data-status={current?.status} />
                  {statusLabel(current?.status ?? edit.status)} · version{" "}
                  {edit.expectedVersion}
                </p>
              </div>
              {current?.status === "DEMO_PUBLISHED" && (
                <Link
                  className="text-link"
                  href={`/experiences/${current.seedKey}`}
                  target="_blank"
                >
                  View live listing
                </Link>
              )}
            </div>
            <p className="notice">
              Demo review checks do not verify real suppliers or enable live
              sales. Publishing only exposes this fictional listing in the demo.
            </p>
            <nav className="admin-tabs" aria-label="Listing sections">
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
            <fieldset disabled={busy}>
              <ListingForm edit={edit} set={set} section={section} />
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
              <button disabled={!dirty || busy}>Save audited changes</button>
            </div>
          </form>
        ) : (
          <>
            <h2>Choose a listing to edit.</h2>
            <p>
              Every field travellers see is editable here: copy, prices, party
              rules, schedule, logistics, access, media and events.
            </p>
            <p role="status" className="muted">
              {status}
            </p>
            <button
              className="secondary"
              onClick={() => load().catch((e) => setStatus(e.message))}
            >
              Reload catalogue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
