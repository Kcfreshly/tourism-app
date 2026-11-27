"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  serviceStatusLabel,
  serviceTitles,
  type ServiceKind,
  type ServiceStatus,
} from "@/modules/bookings/domain/trip-checkout";
import { assigneeLines } from "@/modules/bookings/domain/service-request";
import { airports, type AirportPickup } from "@/modules/trips/domain/profile";
import { showToast } from "./toast";

// Mirrors QueuedService from the API.
type Request = {
  id: string;
  version: number;
  orderReference: string;
  service: ServiceKind;
  date: string;
  startTime: string;
  label: string;
  status: ServiceStatus;
  matchBy: string;
  assignee: Record<string, string> | null;
  contact: { name: string; phone: string };
  totalMinor: number;
  arrival?: AirportPickup;
};

const isCar = (s: ServiceKind) =>
  s === "CAR" || s === "NIGHT_CAR" || s === "AIRPORT_PICKUP";

// What the driver needs to meet the flight; missing details are flagged.
function arrivalFacts(a: AirportPickup): [string, string, boolean?][] {
  return [
    ["Airport", airports[a.airport]],
    ["Flight", a.flight || "Not given yet", !a.flight],
    [
      "Lands",
      `${shortDay(a.landingDate)}${a.landingTime ? ` · ${clockLabel(a.landingTime)}` : " · time not given yet"}`,
      !a.landingTime,
    ],
    [
      "Party",
      `${a.travellers} ${a.travellers === 1 ? "traveller" : "travellers"} · ${a.bags} ${a.bags === 1 ? "bag" : "bags"}`,
    ],
  ];
}
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

async function call(method: "GET" | "PATCH", body?: unknown) {
  const r = await fetch("/api/v1/admin/service-requests", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data;
}

function RequestCard({ r, onChanged }: { r: Request; onChanged: () => void }) {
  const [name, setName] = useState(r.assignee?.name ?? "");
  const [phone, setPhone] = useState(r.assignee?.phone ?? "");
  const [vehicle, setVehicle] = useState(r.assignee?.vehicle ?? "");
  const [plate, setPlate] = useState(r.assignee?.plate ?? "");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(r.status === "REQUESTED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = isCar(r.service) ? "Driver" : "Guide";

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      await call("PATCH", { id: r.id, expectedVersion: r.version, ...body });
      showToast({ message: done });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card admin-service" data-status={r.status}>
      <div className="admin-service-head">
        <div>
          <h3>{serviceTitles[r.service]}</h3>
          <p className="muted">
            {shortDay(r.date)}
            {r.service === "AIRPORT_PICKUP" && !r.arrival?.landingTime
              ? ""
              : ` · ${clockLabel(r.arrival?.landingTime || r.startTime)}`}{" "}
            · {r.label}
          </p>
        </div>
        <span
          className="status-chip"
          data-tone={
            r.status === "MATCHED"
              ? "ok"
              : r.status === "REQUESTED"
                ? "wait"
                : undefined
          }
        >
          {serviceStatusLabel(r.service, r.status)}
        </span>
      </div>
      <dl className="admin-service-facts">
        <div>
          <dt>Order</dt>
          <dd>{r.orderReference}</dd>
        </div>
        <div>
          <dt>Traveller</dt>
          <dd>
            {r.contact.name},{" "}
            <a href={`tel:${r.contact.phone}`}>{r.contact.phone}</a>
          </dd>
        </div>
        <div>
          <dt>{r.status === "REQUESTED" ? "Match by" : "Deadline was"}</dt>
          <dd>{when(r.matchBy)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatMoney(r.totalMinor)}</dd>
        </div>
        {r.arrival &&
          arrivalFacts(r.arrival).map(([k, v, missing]) => (
            <div key={k} data-missing={missing || undefined}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        {assigneeLines(r.service, r.assignee).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {r.status === "UNMATCHED" ? (
        <p className="notice">
          Nobody was matched in time. Refund this part in full from the payment
          provider’s dashboard until refunds are built in.
        </p>
      ) : editing ? (
        <form
          className="admin-service-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              { action: "MATCH", assignee: { name, phone, vehicle, plate } },
              `${role} matched. The traveller can see who it is.`,
            );
          }}
        >
          <label className="field">
            <span>{role}’s name</span>
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              required
              type="tel"
              placeholder="+234 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {isCar(r.service) && (
            <>
              <label className="field">
                <span>Vehicle</span>
                <input
                  required
                  maxLength={80}
                  placeholder="Toyota Sienna, silver"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Plate</span>
                <input
                  required
                  maxLength={20}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="admin-save-actions">
            <button type="submit" disabled={busy}>
              {r.status === "MATCHED"
                ? `Change ${role.toLowerCase()}`
                : `Match ${role.toLowerCase()}`}
            </button>
            {r.status === "MATCHED" && (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="admin-save-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing(true)}
          >
            Change {role.toLowerCase()}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => act({ action: "COMPLETE" }, "Marked as completed.")}
          >
            Mark completed
          </button>
        </div>
      )}
      {r.status !== "UNMATCHED" && (
        <details className="admin-service-unmatch">
          <summary>Can’t find a {role.toLowerCase()}?</summary>
          <label className="field">
            <span>Why (kept in the request’s history)</span>
            <input
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="danger"
            disabled={busy || note.trim().length < 3}
            onClick={() =>
              act(
                { action: "UNMATCH", note },
                "Marked as refund due. The traveller has been told.",
              )
            }
          >
            Mark as refund due
          </button>
        </details>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

const groups: { status: ServiceStatus; title: string; empty: string }[] = [
  {
    status: "REQUESTED",
    title: "Needs a match",
    empty: "Every paid car and guide has someone.",
  },
  { status: "MATCHED", title: "Matched", empty: "Nothing matched yet." },
  { status: "UNMATCHED", title: "Refund due", empty: "No refunds due." },
];

// Staff match drivers and guides to paid trips, soonest first. Anything
// still unmatched at its deadline (48 h before) moves to "Refund due".
export default function AdminServiceRequests() {
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [error, setError] = useState("");
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    let active = true;
    call("GET")
      .then((data) => active && setRequests(data))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [loads]);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!requests) return <p className="muted">Loading requests…</p>;
  return (
    <div className="admin-services">
      {groups.map((g) => {
        const list = requests.filter((r) => r.status === g.status);
        return (
          <section key={g.status} aria-label={g.title}>
            <h3 className="admin-services-title">
              {g.title} <span className="muted">({list.length})</span>
            </h3>
            {list.length ? (
              <ul className="admin-services-list">
                {list.map((r) => (
                  <RequestCard
                    key={`${r.id}:${r.version}`}
                    r={r}
                    onChanged={() => setLoads((n) => n + 1)}
                  />
                ))}
              </ul>
            ) : (
              <p className="muted">{g.empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
