"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  catalogueEditSchema,
  emptyReview,
  listingReadiness,
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
import { knownTags } from "@/modules/catalogue/domain/tags";
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
    nightVisitAllowed: r.nightVisitAllowed ?? false,
    status: row.status as Edit["status"],
    review: row.review ?? emptyReview,
    story: storyFor(live),
    tags: knownTags(r.tags),
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
    images: r.images ?? [],
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
    tags: edit.tags,
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

const approved = {
  content: true,
  rates: true,
  capacity: true,
  policy: true,
  media: true,
};

function statusLabel(status: string) {
  return status.replace("DEMO_", "").replace("_", " ").toLowerCase();
}

type Deleted = {
  auditId: string;
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: string;
  reason: string | null;
};

// `canDelete` is true for super admins; the API enforces the same rule.
export default function AdminCatalogue({
  canDelete = false,
}: {
  canDelete?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [edit, setEdit] = useState<FullEdit | null>(null),
    [baseline, setBaseline] = useState(""),
    [section, setSection] = useState<SectionId>("basics"),
    [status, setStatus] = useState("Loading catalogue…"),
    [problems, setProblems] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [draftError, setDraftError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [deleted, setDeleted] = useState<Deleted[]>([]),
    [reason, setReason] = useState("");
  const dirty = !!edit && JSON.stringify(edit) !== baseline;
  const current = rows.find((r) => r.id === edit?.id);
  const editor = useRef<HTMLDivElement>(null);

  function focusEditor() {
    const panel = editor.current;
    if (!panel) return;
    if (window.matchMedia?.("(max-width: 900px)").matches) {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: "start" });
    } else {
      panel.focus();
    }
  }

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
  async function loadDeleted() {
    const r = await fetch("/api/v1/admin/catalogue/deleted");
    const body = await r.json();
    if (r.ok) setDeleted(body.data);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/catalogue/deleted")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body) => {
        if (active) setDeleted(body.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function remove() {
    if (!edit || !current) return;
    if (
      !window.confirm(
        `Delete “${displayName(edit.name)}”? Travellers stop seeing it at once. A full copy stays in the audit trail and it can be restored from Recently deleted.`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch("/api/v1/admin/catalogue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          expectedVersion: current.version,
          reason: reason.trim() || undefined,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error.message);
      setRows((rows) => rows.filter((row) => row.id !== current.id));
      setEdit(null);
      setBaseline("");
      setReason("");
      setStatus("Deleted. Restore it from Recently deleted if needed.");
      await loadDeleted();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(item: Deleted) {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/admin/catalogue/deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: item.auditId }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error.message);
      setRows((rows) => [body.data, ...rows]);
      setDeleted((list) => list.filter((d) => d.auditId !== item.auditId));
      setStatus(`Restored “${displayName(item.name)}”.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

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
    focusEditor();
  }
  function set(patch: Partial<FullEdit>) {
    setEdit((e) => (e ? { ...e, ...patch } : e));
  }
  // Saves the editor, optionally changing status. Publishing records the
  // staff member's approval by ticking every review check.
  async function save(change?: "PUBLISH" | "UNPUBLISH") {
    if (!edit) return;
    const next: FullEdit =
      change === "PUBLISH"
        ? { ...edit, status: "DEMO_PUBLISHED", review: approved }
        : change === "UNPUBLISH"
          ? { ...edit, status: "PAUSED" }
          : edit;
    const parsed = catalogueEditSchema.safeParse(cleanEdit(next));
    const missing =
      parsed.success && change === "PUBLISH"
        ? listingReadiness(parsed.data)
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
      const saved = editRow(body.data);
      setEdit(saved);
      setBaseline(JSON.stringify(saved));
      setStatus(
        change === "PUBLISH"
          ? "Published. Travellers can see it now."
          : change === "UNPUBLISH"
            ? "Unpublished. Hidden from new bookings."
            : `Saved version ${body.data.version}.`,
      );
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
      <aside className="card admin-library">
        <div className="admin-library-tools">
          <h2 id="admin-listings-heading">Listings</h2>
          <details className="admin-create">
            <summary>Create listing</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  dirty &&
                  !window.confirm("Discard unsaved changes to this listing?")
                )
                  return;
                setDraftError("");
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
                  setProblems([]);
                  setStatus("Fictional draft created.");
                  focusEditor();
                } catch (e) {
                  setDraftError(
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
              {draftError && (
                <p className="field-error" role="alert">
                  {draftError}
                </p>
              )}
            </form>
          </details>
          <label>
            Search listings
            <input
              type="search"
              placeholder="Listing name or ID"
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
        </div>
        <div className="catalogue-list" aria-label="Listing results">
          {shown.map((row) => (
            <button
              className="secondary"
              key={row.id}
              disabled={busy}
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
        {deleted.length > 0 && (
          <details className="admin-deleted">
            <summary>Recently deleted ({deleted.length})</summary>
            <ul>
              {deleted.map((d) => (
                <li key={d.auditId}>
                  <span>{displayName(d.name)}</span>
                  <small className="muted">
                    Deleted by {d.deletedBy} ·{" "}
                    {new Date(d.deletedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                    {d.reason ? ` · ${d.reason}` : ""}
                  </small>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => restore(d)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </aside>
      <div
        className="card admin-editor"
        ref={editor}
        tabIndex={-1}
        role="region"
        aria-label="Listing editor"
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
                href="#admin-listings-heading"
                className="text-link admin-back"
              >
                Back to listings
              </a>
              <div className="admin-editor-head">
                <div>
                  <h2>{displayName(edit.name)}</h2>
                  <p className="muted">
                    <span
                      className="status-dot"
                      data-status={current?.status}
                    />
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
            </div>
            <fieldset className="admin-editor-fields" disabled={busy}>
              {section === "review" && (
                <p className="notice">
                  New listings are added by staff, so publishing needs no second
                  approval.
                </p>
              )}
              <ListingForm edit={edit} set={set} section={section} />
            </fieldset>
            {section === "review" && canDelete && current && (
              <div className="admin-danger">
                <h3>Delete listing</h3>
                <p className="form-hint">
                  Super admins only. The listing disappears for travellers, and
                  a full copy is kept in the audit trail so it can be restored.
                </p>
                <label>
                  Reason (optional)
                  <input
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={remove}
                >
                  Delete listing
                </button>
              </div>
            )}
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
            <h2>Choose a listing to edit</h2>
            <p className="muted">
              Select a listing to update its details, pricing or publication
              status.
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
          </div>
        )}
      </div>
    </div>
  );
}
