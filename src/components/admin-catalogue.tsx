"use client";
import { useEffect, useState } from "react";
import categories from "../../tourism-v1-handoff/data/categories.json";
import type { Experience } from "@/modules/catalogue/domain/experience";
import {
  emptyReview,
  type catalogueEditSchema,
} from "@/modules/catalogue/domain/catalogue";
import type { z } from "zod";
type Edit = z.infer<typeof catalogueEditSchema>;
type Row = {
  id: string;
  seedKey: string;
  version: number;
  status: string;
  record: Experience;
  review: Edit["review"];
};
function editRow(row: Row): Edit {
  return {
    id: row.id,
    expectedVersion: row.version,
    name: row.record.name,
    categoryId: row.record.categoryId as Edit["categoryId"],
    zoneId: row.record.zoneId as Edit["zoneId"],
    kind: row.record.kind as Edit["kind"],
    durationMinMinutes: row.record.durationMinMinutes,
    durationMaxMinutes: row.record.durationMaxMinutes,
    rateMinor: row.record.offer.rateMinor,
    capacityPerSlot: row.record.offer.capacityPerSlot,
    status: row.status as Edit["status"],
    review: row.review ?? emptyReview,
  };
}
export default function AdminCatalogue() {
  const [rows, setRows] = useState<Row[]>([]),
    [edit, setEdit] = useState<Edit | null>(null),
    [status, setStatus] = useState("Loading catalogue…"),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
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
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/v1/admin/catalogue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error.message);
      setRows((rows) =>
        rows.map((row) => (row.id === body.data.id ? body.data : row)),
      );
      setEdit(editRow(body.data));
      setStatus(`Saved version ${body.data.version}. Audit recorded.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof Edit>(key: K, value: Edit[K]) {
    setEdit((e) => (e ? { ...e, [key]: value } : e));
  }
  return (
    <>
      <div className="admin-layout">
        <aside className="card card-body">
          <h2>Catalogue</h2>
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
                setEdit(editRow(body.data));
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
          <div className="catalogue-list">
            {rows.map((row) => (
              <button
                className="secondary"
                key={row.id}
                aria-pressed={edit?.id === row.id}
                onClick={() => {
                  setEdit(editRow(row));
                  setStatus("Editing local demo supply.");
                }}
              >
                <span>{row.record.name}</span>
                <small>
                  <span className="status-dot" data-status={row.status} />
                  {row.status.replace("_", " ").toLowerCase()} · v{row.version}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <div className="card form-card">
          {edit ? (
            <form onSubmit={save}>
              <h2>Edit fictional supply</h2>
              <p className="notice">
                Demo review checks do not verify real suppliers or enable live
                sales. Publish only exposes this fictional listing in the demo.
              </p>
              <fieldset disabled={busy}>
                <label>
                  Name
                  <input
                    required
                    minLength={5}
                    maxLength={140}
                    value={edit.name}
                    onChange={(e) => field("name", e.target.value)}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Category
                    <select
                      value={edit.categoryId}
                      onChange={(e) =>
                        field(
                          "categoryId",
                          e.target.value as Edit["categoryId"],
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Service zone
                    <select
                      value={edit.zoneId}
                      onChange={(e) =>
                        field("zoneId", e.target.value as Edit["zoneId"])
                      }
                    >
                      <option>LEKKI</option>
                      <option>VI</option>
                      <option>MAINLAND</option>
                    </select>
                  </label>
                  <label>
                    Kind
                    <select
                      value={edit.kind}
                      onChange={(e) =>
                        field("kind", e.target.value as Edit["kind"])
                      }
                    >
                      <option>MAIN</option>
                      <option>LIGHT</option>
                      <option>FULL_DAY</option>
                    </select>
                  </label>
                  <label>
                    Rate (integer kobo)
                    <input
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={edit.rateMinor}
                      onChange={(e) =>
                        field("rateMinor", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Minimum minutes
                    <input
                      required
                      type="number"
                      min={30}
                      max={420}
                      value={edit.durationMinMinutes}
                      onChange={(e) =>
                        field("durationMinMinutes", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Maximum minutes
                    <input
                      required
                      type="number"
                      min={30}
                      max={480}
                      value={edit.durationMaxMinutes}
                      onChange={(e) =>
                        field("durationMaxMinutes", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Demo capacity per slot
                    <input
                      required
                      type="number"
                      min={1}
                      max={100}
                      value={edit.capacityPerSlot}
                      onChange={(e) =>
                        field("capacityPerSlot", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={edit.status}
                      onChange={(e) =>
                        field("status", e.target.value as Edit["status"])
                      }
                    >
                      <option>DRAFT</option>
                      <option>RESEARCHED</option>
                      <option>DEMO_VERIFIED</option>
                      <option>DEMO_PUBLISHED</option>
                      <option>PAUSED</option>
                    </select>
                  </label>
                </div>
                <h3>Fictional review checklist</h3>
                {(Object.keys(emptyReview) as (keyof typeof emptyReview)[]).map(
                  (key) => (
                    <label className="check" key={key}>
                      <input
                        type="checkbox"
                        checked={edit.review[key]}
                        onChange={(e) =>
                          field("review", {
                            ...edit.review,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      {key} reviewed for demo testing
                    </label>
                  ),
                )}
                <p className="muted">
                  To publish a draft: review every field, save DEMO_VERIFIED,
                  then save DEMO_PUBLISHED. Pausing stops new selections; saved
                  drafts retain their existing references.
                </p>
                <button>Save audited changes</button>
              </fieldset>
            </form>
          ) : (
            <>
              <h2>Choose a record to review.</h2>
              <p>No live supplier records can be published here.</p>
            </>
          )}
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
      </div>
    </>
  );
}
