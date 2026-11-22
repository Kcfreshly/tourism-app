"use client";
import { useEffect, useState } from "react";

type Event = {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  createdAt: string;
  version: number | null;
  status: string | null;
  details: { changed?: string[]; reason?: string | null };
};

const actionLabels: Record<string, string> = {
  CATALOGUE_SNAPSHOT: "Starting snapshot",
  DEMO_CATALOGUE_DRAFT_CREATED: "Created",
  DEMO_CATALOGUE_UPDATED: "Saved",
  CATALOGUE_DELETED: "Deleted",
  CATALOGUE_RESTORED: "Restored",
};

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function who(e: Event) {
  if (e.actorName) return e.actorName;
  if (e.actorId.startsWith("migration-")) return "Database update";
  return "System";
}

// Read-only: the audit trail can be read by every admin and changed by no one.
// Each saved version is kept as a full snapshot there.
export default function ListingHistory({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const [events, setEvents] = useState<Event[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/admin/catalogue/history?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (active) setEvents(body.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, version]);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!events) return <p className="muted">Loading history…</p>;
  return (
    <div className="admin-history">
      <p className="form-hint">
        Every change is kept in the audit trail with a full copy of the listing.
        Nobody can edit or remove these entries from the admin panel.
      </p>
      {events.length ? (
        <ol>
          {events.map((e) => (
            <li key={e.id}>
              <strong>{actionLabels[e.action] ?? e.action}</strong>
              {e.version ? ` · version ${e.version}` : ""}
              <span className="muted">
                {" "}
                · {who(e)} · {when(e.createdAt)}
              </span>
              {e.details.changed && e.details.changed.length > 0 && (
                <small>Changed: {e.details.changed.join(", ")}</small>
              )}
              {e.details.reason && <small>Reason: {e.details.reason}</small>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          No history yet. Run the latest database update to record a starting
          snapshot of every listing.
        </p>
      )}
    </div>
  );
}
