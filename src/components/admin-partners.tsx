"use client";
import { useEffect, useState } from "react";
import { showToast } from "./toast";
import { runsPastMidnight } from "@/modules/catalogue/domain/catalogue";
import {
  changedFields,
  toPublishedExperience,
  type Experience,
} from "@/modules/catalogue/domain/experience";
import {
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  storyFor,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import { listingDetails } from "@/modules/catalogue/domain/listing-details";
import {
  packageLength,
  packageRoute,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import {
  partnerStatusLabels,
  productTypeLabels,
  type Partner,
  type ProductType,
} from "@/modules/partners/domain/partner";

type Queued = {
  id: string;
  partnerId: string;
  businessName: string;
  productType: ProductType;
  productId: string | null;
  name: string;
  proposed: unknown;
  version: number;
  submittedAt: string | null;
  live: { record: unknown; version: number } | null;
};
type PartnerRow = Omit<Partner, "createdAt"> & { createdAt: string };

const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data;
}

// Field names a partner changed against the live version.
function changes(q: Queued) {
  if (!q.live) return null;
  if (q.productType === "EXPERIENCE")
    return changedFields(q.live.record as Experience, q.proposed as Experience);
  const before = q.live.record as Record<string, unknown>;
  const after = q.proposed as Record<string, unknown>;
  return Object.keys({ ...before, ...after }).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
}

function ExperienceSummary({ q }: { q: Queued }) {
  const e = toPublishedExperience({
    id: q.id,
    seedKey: `partner-${q.id}`,
    record: q.proposed,
  });
  const story = storyFor(e);
  const d = listingDetails(e);
  return (
    <div className="admin-submission-body">
      {e.photos?.length ? (
        <ul className="admin-submission-photos" aria-label="Photos">
          {e.photos.map((src, i) => (
            <li key={src}>
              <img src={src} alt={e.photoAlts?.[i] || `Photo ${i + 1}`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No photos uploaded.</p>
      )}
      <p>
        <strong>{story.teaser}</strong>
      </p>
      <p>{story.summary}</p>
      <dl className="admin-submission-facts">
        <dt>Price</dt>
        <dd>
          {formatMoney(e.offer.rateMinor)}{" "}
          {priceBasisLabel(e.offer.priceBasis ?? "PER_ADULT")}
        </dd>
        <dt>Length</dt>
        <dd>{formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}</dd>
        <dt>Where</dt>
        <dd>
          {d.venue}, {zoneLabel(e.zoneId)}
        </dd>
        <dt>Run by</dt>
        <dd>{d.operator}</dd>
        <dt>Hours</dt>
        <dd>
          {e.availabilityLocal.opensAt}–{e.availabilityLocal.closesAt}
        </dd>
        <dt>Included</dt>
        <dd>{e.inclusions.join(", ") || "Nothing listed"}</dd>
      </dl>
    </div>
  );
}

function TripSummary({ q }: { q: Queued }) {
  const p = q.proposed as TripPackage;
  return (
    <div className="admin-submission-body">
      <p>{p.summary}</p>
      <dl className="admin-submission-facts">
        <dt>Route</dt>
        <dd>{packageRoute(p)}</dd>
        <dt>Length</dt>
        <dd>{packageLength(p)}</dd>
        <dt>Price</dt>
        <dd>{formatMoney(p.priceMinor)} per person</dd>
        <dt>Departures</dt>
        <dd>{p.departures.map((d) => d.date).join(", ") || "None"}</dd>
        <dt>Run by</dt>
        <dd>{p.operator}</dd>
      </dl>
      <ol className="admin-submission-days">
        {p.route.map((r) => (
          <li key={r.day}>
            <strong>
              Day {r.day}: {r.place}
            </strong>{" "}
            {r.plan}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Review({
  q,
  onDone,
}: {
  q: Queued;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState(""),
    [night, setNight] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const late =
    q.productType === "EXPERIENCE" &&
    runsPastMidnight(
      toPublishedExperience({ id: q.id, seedKey: "", record: q.proposed }),
    );
  const changed = changes(q);

  async function decide(decision: "APPROVE" | "DECLINE") {
    setError("");
    setBusy(true);
    try {
      await call("/api/v1/admin/submissions", "PATCH", {
        id: q.id,
        expectedVersion: q.version,
        decision,
        reason: reason.trim() || undefined,
        nightVisitAllowed: late ? night : undefined,
      });
      onDone(
        decision === "APPROVE"
          ? `Approved “${displayName(q.name)}”. It's live now.`
          : `Sent “${displayName(q.name)}” back to ${q.businessName}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
      setBusy(false);
    }
  }

  return (
    <li className="card admin-submission">
      <div className="admin-editor-head">
        <div>
          <h3>{displayName(q.name)}</h3>
          <p className="muted">
            {productTypeLabels[q.productType]} · {q.businessName} · submitted{" "}
            {day(q.submittedAt)}
          </p>
        </div>
        <span className="admin-demo">
          {q.live ? "Change to live listing" : "New"}
        </span>
      </div>
      {changed && (
        <p className="notice">
          Changed: {changed.length ? changed.join(", ") : "nothing"}. The live
          version stays on sale until you approve.
        </p>
      )}
      {q.productType === "EXPERIENCE" ? (
        <ExperienceSummary q={q} />
      ) : (
        <TripSummary q={q} />
      )}
      <fieldset className="admin-submission-decision" disabled={busy}>
        {late && (
          <label className="check">
            <input
              type="checkbox"
              checked={night}
              onChange={(e) => setNight(e.target.checked)}
            />
            Runs past midnight: the night-time security review has passed.
          </label>
        )}
        <label>
          What should the partner change? (required to send back)
          <textarea
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-save-actions">
          <button
            type="button"
            className="secondary"
            disabled={reason.trim().length < 5}
            onClick={() => decide("DECLINE")}
          >
            Send back
          </button>
          <button
            type="button"
            disabled={late && !night}
            onClick={() => decide("APPROVE")}
          >
            Approve &amp; publish
          </button>
        </div>
      </fieldset>
    </li>
  );
}

function PartnerItem({
  p,
  onChanged,
}: {
  p: PartnerRow;
  onChanged: (next: PartnerRow, message: string) => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(status: "VERIFIED" | "DECLINED" | "SUSPENDED") {
    setError("");
    setBusy(true);
    try {
      const next = await call("/api/v1/admin/partners", "PATCH", {
        id: p.id,
        expectedVersion: p.version,
        status,
        reason: reason.trim() || undefined,
      });
      setReason("");
      onChanged(next, `${p.businessName}: ${partnerStatusLabels[status]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }
  const needsReason = reason.trim().length < 5;
  return (
    <li className="card admin-partner">
      <div className="admin-editor-head">
        <div>
          <h3>{p.businessName}</h3>
          <p className="muted">
            <span className="status-dot" data-status={p.status} />
            {partnerStatusLabels[p.status]} · applied {day(p.createdAt)}
          </p>
        </div>
      </div>
      <p>{p.offering}</p>
      <p className="muted">
        {p.contactEmail} · {p.phone}
      </p>
      {p.decisionReason && (
        <p className="muted">Last reason: {p.decisionReason}</p>
      )}
      {p.status !== "DECLINED" && (
        <fieldset className="admin-submission-decision" disabled={busy}>
          {p.status !== "SUSPENDED" && (
            <label>
              Reason (required to decline or suspend)
              <input
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-save-actions">
            {p.status === "PENDING" && (
              <>
                <button
                  type="button"
                  className="secondary"
                  disabled={needsReason}
                  onClick={() => decide("DECLINED")}
                >
                  Decline
                </button>
                <button type="button" onClick={() => decide("VERIFIED")}>
                  Verify partner
                </button>
              </>
            )}
            {p.status === "VERIFIED" && (
              <button
                type="button"
                className="danger"
                disabled={needsReason}
                onClick={() => decide("SUSPENDED")}
              >
                Suspend
              </button>
            )}
            {p.status === "SUSPENDED" && (
              <button type="button" onClick={() => decide("VERIFIED")}>
                Reinstate
              </button>
            )}
          </div>
        </fieldset>
      )}
    </li>
  );
}

// Staff verify partner businesses and approve or send back what they submit.
export default function AdminPartners() {
  const [queue, setQueue] = useState<Queued[] | null>(null),
    [partners, setPartners] = useState<PartnerRow[]>([]),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");

  async function load() {
    const [q, p] = await Promise.all([
      call("/api/v1/admin/submissions", "GET"),
      call("/api/v1/admin/partners", "GET"),
    ]);
    setQueue(q);
    setPartners(p);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      call("/api/v1/admin/submissions", "GET"),
      call("/api/v1/admin/partners", "GET"),
    ])
      .then(([q, p]) => {
        if (!active) return;
        setQueue(q);
        setPartners(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!queue) return <p className="muted">Loading partners…</p>;
  const pending = partners.filter((p) => p.status === "PENDING");
  const others = partners.filter((p) => p.status !== "PENDING");

  return (
    <div className="admin-partners">
      <p role="status" className="muted">
        {status}
      </p>
      <section aria-labelledby="queue-heading">
        <h3 id="queue-heading">Waiting for approval ({queue.length})</h3>
        {queue.length ? (
          <ul className="admin-submissions">
            {queue.map((q) => (
              <Review
                key={`${q.id}-${q.version}`}
                q={q}
                onDone={(message) => {
                  setStatus(message);
                  showToast({ message });
                  load().catch((e) => setStatus(e.message));
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing to review.</p>
        )}
      </section>
      <section aria-labelledby="applications-heading">
        <h3 id="applications-heading">
          Partner applications ({pending.length})
        </h3>
        {pending.length ? (
          <ul className="admin-submissions">
            {pending.map((p) => (
              <PartnerItem
                key={`${p.id}-${p.version}`}
                p={p}
                onChanged={(next, message) => {
                  setPartners((list) =>
                    list.map((x) => (x.id === next.id ? next : x)),
                  );
                  setStatus(message);
                  showToast({ message });
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="muted">No new applications.</p>
        )}
      </section>
      {others.length > 0 && (
        <details className="admin-advanced">
          <summary>All partners ({others.length})</summary>
          <ul className="admin-submissions">
            {others.map((p) => (
              <PartnerItem
                key={`${p.id}-${p.version}`}
                p={p}
                onChanged={(next, message) => {
                  setPartners((list) =>
                    list.map((x) => (x.id === next.id ? next : x)),
                  );
                  setStatus(message);
                  showToast({ message });
                }}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
