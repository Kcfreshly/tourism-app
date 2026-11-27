"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { catalogueEditSchema } from "@/modules/catalogue/domain/catalogue";
import type { Experience } from "@/modules/catalogue/domain/experience";
import { displayName } from "@/modules/catalogue/domain/experience-content";
import {
  packageSchema,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import {
  productTypeLabels,
  submissionStatusLabels,
  type ProductType,
  type SubmissionStatus,
} from "@/modules/partners/domain/partner";
import ListingForm, {
  partnerSections,
  type FullEdit,
  type SectionId,
} from "./admin-listing-form";
import {
  TripForm,
  cleanTrip,
  draftOf,
  tripSections,
  type Draft,
  type TripSectionId,
} from "./admin-packages";
import { cleanEdit, editRow } from "./listing-edit";

type Submission = {
  id: string;
  productType: ProductType;
  productId: string | null;
  name: string;
  proposed: unknown;
  status: SubmissionStatus;
  reason: string | null;
  version: number;
  updatedAt: string;
};
type Item = {
  productType: ProductType;
  productId: string | null;
  name: string;
  live: { status: string; version: number; slug: string } | null;
  submission: Submission | null;
};

const keyOf = (i: Item) => i.productId ?? i.submission!.id;

const issues = (error: {
  issues: { path: PropertyKey[]; message: string }[];
}) =>
  error.issues.map((i) =>
    i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message,
  );

function stateOf(item: Item) {
  if (item.submission)
    return {
      status: item.submission.status,
      label: submissionStatusLabels[item.submission.status],
    };
  return item.live?.status === "DEMO_PUBLISHED"
    ? { status: "DEMO_PUBLISHED", label: "Live" }
    : { status: "PAUSED", label: "Not on sale" };
}

async function send(method: string, body: unknown) {
  const r = await fetch("/api/v1/partner/submissions", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data as Submission;
}

// A partner's listings and trips. Partners edit a draft and send it to staff;
// nothing reaches travellers until staff approve it, and a live listing keeps
// selling unchanged while an edit to it waits.
export default function PartnerListings() {
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [status, setStatus] = useState("Loading your listings…"),
    [busy, setBusy] = useState(false),
    [type, setType] = useState<ProductType>("EXPERIENCE"),
    [name, setName] = useState(""),
    [createError, setCreateError] = useState(""),
    [dirty, setDirty] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const item = items.find((i) => keyOf(i) === selected);

  async function load() {
    const r = await fetch("/api/v1/partner/listings");
    const body = await r.json();
    if (!r.ok) throw Error(body.error.message);
    setItems(body.data);
    setStatus(
      body.data.length
        ? "Choose a listing to work on."
        : "No listings yet. Create your first one.",
    );
    return body.data as Item[];
  }
  useEffect(() => {
    let active = true;
    fetch("/api/v1/partner/listings")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (active) {
          setItems(body.data);
          setStatus(
            body.data.length
              ? "Choose a listing to work on."
              : "No listings yet. Create your first one.",
          );
        }
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  function focusEditor() {
    const panel = editor.current;
    if (!panel) return;
    panel.focus({ preventScroll: true });
    if (window.matchMedia?.("(max-width: 900px)").matches)
      panel.scrollIntoView({ block: "start" });
  }
  function choose(key: string) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setDirty(false);
    setSelected(key);
    focusEditor();
  }
  // Replaces an item's submission after a save, submit or withdrawal.
  function saved(next: Submission) {
    setItems((list) =>
      list.flatMap((i) => {
        const match = i.submission?.id === next.id;
        if (!match) return [i];
        const open = ["DRAFT", "PENDING", "DECLINED"].includes(next.status);
        // A withdrawn new listing disappears; a live one keeps its row.
        if (!open && !i.productId) return [];
        return [{ ...i, name: next.name, submission: open ? next : null }];
      }),
    );
  }

  async function propose(target: Item) {
    setBusy(true);
    try {
      const submission = await send("POST", {
        productType: target.productType,
        productId: target.productId,
      });
      setItems((list) =>
        list.map((i) =>
          keyOf(i) === keyOf(target) ? { ...i, submission } : i,
        ),
      );
      setStatus("Draft started from the live version.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to start a change.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-layout">
      <aside className="card admin-library">
        <div className="admin-library-tools">
          <h2 id="partner-library-heading">Your listings</h2>
          <details className="admin-create">
            <summary>New</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (dirty && !window.confirm("Discard unsaved changes?"))
                  return;
                setCreateError("");
                setBusy(true);
                try {
                  const submission = await send("POST", {
                    productType: type,
                    name,
                  });
                  setItems((list) => [
                    {
                      productType: type,
                      productId: null,
                      name: submission.name,
                      live: null,
                      submission,
                    },
                    ...list,
                  ]);
                  setName("");
                  setDirty(false);
                  setSelected(submission.id);
                  setStatus(
                    "Draft created. Fill in each section, then submit.",
                  );
                  focusEditor();
                } catch (error) {
                  setCreateError(
                    error instanceof Error
                      ? error.message
                      : "Unable to create the draft.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset className="partner-type" disabled={busy}>
                <legend>What are you adding?</legend>
                <div className="admin-filters" role="group">
                  {(["EXPERIENCE", "PACKAGE"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      aria-pressed={type === t}
                      onClick={() => setType(t)}
                    >
                      {productTypeLabels[t]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                {type === "EXPERIENCE" ? "Activity name" : "Trip title"}
                <input
                  required
                  minLength={5}
                  maxLength={100}
                  placeholder={
                    type === "EXPERIENCE"
                      ? "Lagoon kayak morning"
                      : "3 days in Obudu"
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
        </div>
        <div className="catalogue-list" aria-label="Your listings and trips">
          {items.map((i) => {
            const state = stateOf(i);
            return (
              <button
                key={keyOf(i)}
                className="secondary"
                disabled={busy}
                aria-pressed={selected === keyOf(i)}
                onClick={() => choose(keyOf(i))}
              >
                <span>{displayName(i.name)}</span>
                <small>
                  <span className="status-dot" data-status={state.status} />
                  {state.label} · {productTypeLabels[i.productType]}
                  {i.live && i.submission ? " · live version on sale" : ""}
                </small>
              </button>
            );
          })}
          {!items.length && <p className="muted">{status}</p>}
        </div>
      </aside>
      <div
        className="card admin-editor"
        ref={editor}
        tabIndex={-1}
        role="region"
        aria-label="Listing editor"
      >
        {!item ? (
          <div className="admin-editor-empty">
            <h2>Plan an activity or trip</h2>
            <p className="muted">
              Create a draft with New, fill in each section, then submit it.
              Fastlife publishes it or sends it back with what to change.
            </p>
            <p role="status" className="muted">
              {status}
            </p>
            <button
              className="secondary"
              onClick={() => load().catch((e) => setStatus(e.message))}
            >
              Reload
            </button>
          </div>
        ) : !item.submission ? (
          <div className="admin-editor-empty">
            <a href="#partner-library-heading" className="text-link admin-back">
              Back to your listings
            </a>
            <h2>{displayName(item.name)}</h2>
            <p className="muted">
              {stateOf(item).label}. To change it, start a draft from the live
              version. The live version stays on sale until Fastlife approves
              your change.
            </p>
            <div className="admin-save-actions">
              <button disabled={busy} onClick={() => propose(item)}>
                Propose a change
              </button>
              {item.live?.status === "DEMO_PUBLISHED" && (
                <Link
                  className="button secondary"
                  target="_blank"
                  href={
                    item.productType === "PACKAGE"
                      ? `/packages/${item.live.slug}`
                      : `/experiences/${item.live.slug}`
                  }
                >
                  View live
                </Link>
              )}
            </div>
            <p role="status" className="muted">
              {status}
            </p>
          </div>
        ) : item.productType === "EXPERIENCE" ? (
          <ExperienceEditor
            key={`${item.submission.id}`}
            item={item}
            submission={item.submission}
            onSaved={saved}
            onDirty={setDirty}
          />
        ) : (
          <TripEditor
            key={`${item.submission.id}`}
            item={item}
            submission={item.submission}
            onSaved={saved}
            onDirty={setDirty}
          />
        )}
      </div>
    </div>
  );
}

type EditorProps = {
  item: Item;
  submission: Submission;
  onSaved: (s: Submission) => void;
  onDirty: (dirty: boolean) => void;
};

function Banner({
  item,
  submission,
}: Omit<EditorProps, "onSaved" | "onDirty">) {
  if (submission.status === "PENDING")
    return (
      <p className="notice" role="status">
        In review.{" "}
        {item.live
          ? "The live version stays on sale until Fastlife approves this change. "
          : ""}
        Saving changes takes it out of review until you submit again.
      </p>
    );
  if (submission.reason)
    return (
      <div className="notice notice-warning" role="status">
        <h3>Fastlife asked for changes</h3>
        <p>{submission.reason}</p>
      </div>
    );
  return null;
}

// Shared save bar and editor chrome for activities and trips.
function EditorShell({
  item,
  submission,
  sections,
  section,
  onSection,
  dirty,
  busy,
  problems,
  status,
  onDiscard,
  onSave,
  onWithdraw,
  children,
}: {
  item: Item;
  submission: Submission;
  sections: readonly { id: string; label: string }[];
  section: string;
  onSection: (id: string) => void;
  dirty: boolean;
  busy: boolean;
  problems: string[];
  status: string;
  onDiscard: () => void;
  onSave: (submit: boolean) => void;
  onWithdraw: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave(false);
      }}
    >
      <div className="admin-editor-top">
        <a href="#partner-library-heading" className="text-link admin-back">
          Back to your listings
        </a>
        <div className="admin-editor-head">
          <div>
            <h2>{displayName(submission.name)}</h2>
            <p className="muted">
              <span className="status-dot" data-status={submission.status} />
              {submissionStatusLabels[submission.status]} ·{" "}
              {productTypeLabels[item.productType]}
              {item.live ? " · change to a live listing" : " · new"}
            </p>
          </div>
        </div>
        <nav className="admin-tabs" aria-label="Sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-pressed={section === s.id}
              onClick={() => onSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
      <fieldset className="admin-editor-fields" disabled={busy}>
        <Banner item={item} submission={submission} />
        {children}
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
            disabled={busy}
            onClick={onWithdraw}
          >
            {item.live ? "Discard draft" : "Delete draft"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!dirty || busy}
            onClick={onDiscard}
          >
            Undo changes
          </button>
          <button className="secondary" disabled={!dirty || busy}>
            Save draft
          </button>
          <button type="button" disabled={busy} onClick={() => onSave(true)}>
            {submission.status === "PENDING" && !dirty
              ? "Submitted"
              : "Submit for review"}
          </button>
        </div>
      </div>
    </form>
  );
}

// Saving, submitting and withdrawing, shared by both editors.
function useDraft<T>(
  initial: T,
  { submission, onSaved, onDirty }: EditorProps,
  payload: (
    value: T,
  ) => { ok: true; body: object } | { ok: false; problems: string[] },
  fromSaved: (s: Submission) => T,
) {
  const [value, setValue] = useState(initial),
    [baseline, setBaseline] = useState(JSON.stringify(initial)),
    [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]),
    [status, setStatus] = useState(
      "Changes are only seen by Fastlife until approved.",
    );
  const dirty = JSON.stringify(value) !== baseline;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(submit: boolean) {
    if (submit && submission.status === "PENDING" && !dirty) return;
    const built = payload(value);
    if (!built.ok) {
      setProblems(built.problems);
      setStatus("Fix the problems below, then try again.");
      return;
    }
    setProblems([]);
    setBusy(true);
    try {
      const next = await send("PATCH", {
        id: submission.id,
        expectedVersion: submission.version,
        submit,
        ...built.body,
      });
      const fresh = fromSaved(next);
      setValue(fresh);
      setBaseline(JSON.stringify(fresh));
      onSaved(next);
      setStatus(
        submit
          ? "Submitted. Fastlife will review it and publish it or tell you what to change."
          : "Draft saved.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed.";
      // Readiness problems come back as one list.
      setProblems(message.includes("; ") ? message.split("; ") : []);
      setStatus(message.includes("; ") ? "Not ready to submit yet." : message);
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (
      !window.confirm(
        "Discard this draft? The live version, if any, stays as it is.",
      )
    )
      return;
    setBusy(true);
    try {
      const next = await send("DELETE", {
        id: submission.id,
        expectedVersion: submission.version,
      });
      setBaseline(JSON.stringify(value));
      onDirty(false);
      onSaved(next);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to discard.");
      setBusy(false);
    }
  }
  return {
    value,
    setValue,
    dirty,
    busy,
    problems,
    status,
    save,
    withdraw,
    discard: () => {
      setValue(JSON.parse(baseline));
      setProblems([]);
    },
  };
}

function experienceEdit(item: Item, s: Submission): FullEdit {
  return editRow({
    id: s.id,
    seedKey: item.live?.slug ?? `partner-${s.id}`,
    status: "DRAFT",
    version: s.version,
    record: s.proposed as Experience,
    review: null,
  });
}

function ExperienceEditor(props: EditorProps) {
  const [section, setSection] = useState<SectionId>("basics");
  const draft = useDraft(
    experienceEdit(props.item, props.submission),
    props,
    (edit) => {
      const parsed = catalogueEditSchema.safeParse(cleanEdit(edit));
      return parsed.success
        ? { ok: true, body: { experience: parsed.data } }
        : { ok: false, problems: issues(parsed.error) };
    },
    (s) => experienceEdit(props.item, s),
  );
  return (
    <EditorShell
      {...props}
      sections={partnerSections}
      section={section}
      onSection={(id) => setSection(id as SectionId)}
      dirty={draft.dirty}
      busy={draft.busy}
      problems={draft.problems}
      status={draft.status}
      onDiscard={draft.discard}
      onSave={draft.save}
      onWithdraw={draft.withdraw}
    >
      <ListingForm
        audience="partner"
        edit={draft.value}
        set={(patch) => draft.setValue((e) => ({ ...e, ...patch }))}
        section={section}
      />
    </EditorShell>
  );
}

function tripDraft(item: Item, s: Submission): Draft {
  const record = s.proposed as TripPackage;
  return draftOf({
    id: s.id,
    slug: item.live?.slug ?? record.slug,
    status: "DRAFT",
    version: s.version,
    record,
  });
}

function TripEditor(props: EditorProps) {
  const [section, setSection] = useState<TripSectionId>("basics");
  const draft = useDraft(
    tripDraft(props.item, props.submission),
    props,
    (d) => {
      const parsed = packageSchema.safeParse(cleanTrip(d.trip));
      return parsed.success
        ? { ok: true, body: { trip: parsed.data } }
        : { ok: false, problems: issues(parsed.error) };
    },
    (s) => tripDraft(props.item, s),
  );
  return (
    <EditorShell
      {...props}
      sections={tripSections.map((s) =>
        s.id === "publish" ? { ...s, label: "Terms & submit" } : s,
      )}
      section={section}
      onSection={(id) => setSection(id as TripSectionId)}
      dirty={draft.dirty}
      busy={draft.busy}
      problems={draft.problems}
      status={draft.status}
      onDiscard={draft.discard}
      onSave={draft.save}
      onWithdraw={draft.withdraw}
    >
      <TripForm
        audience="partner"
        trip={draft.value.trip}
        set={(patch) =>
          draft.setValue((d) => ({ ...d, trip: { ...d.trip, ...patch } }))
        }
        section={section}
      />
    </EditorShell>
  );
}
