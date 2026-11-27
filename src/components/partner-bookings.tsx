"use client";
import { useCallback, useEffect, useState } from "react";
import Icon from "./icons";
import { showToast } from "./toast";
import { bookingStatusLabels } from "@/modules/bookings/domain/checkout";
import type { PartnerBookingView } from "@/modules/bookings/domain/partner-booking";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function guests(b: PartnerBookingView) {
  const line = b.line;
  if (line.kind === "PACKAGE")
    return plural(line.travellers, "traveller", "travellers");
  return [
    plural(line.adults, "adult", "adults"),
    line.children ? plural(line.children, "child", "children") : "",
  ]
    .filter(Boolean)
    .join(", ");
}

const lagosTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

// Partner view labels: from the partner's side, not the traveller's.
const partnerLabel = (b: PartnerBookingView) =>
  b.status === "AWAITING_PARTNER"
    ? "Needs your answer"
    : b.status === "DECLINED"
      ? "Declined · traveller refunded"
      : bookingStatusLabels[b.status];

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

function BookingCard({
  b,
  url,
  showBusiness,
  onDone,
}: {
  b: PartnerBookingView;
  url: string;
  showBusiness: boolean;
  onDone: (next: PartnerBookingView, message: string) => void;
}) {
  const [declining, setDeclining] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const waiting = b.status === "AWAITING_PARTNER";
  async function decide(action: "CONFIRM" | "DECLINE") {
    setBusy(true);
    setError("");
    try {
      const next = await call(url, "PATCH", {
        action,
        id: b.id,
        expectedVersion: b.version,
        ...(action === "DECLINE" ? { reason: reason.trim() } : {}),
      });
      onDone(
        next,
        action === "CONFIRM"
          ? `Confirmed ${b.title} for ${b.guest.name}. They’ve been told.`
          : `Declined ${b.title}. ${b.guest.name} has been told and will be refunded.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work. Retry.");
      setBusy(false);
    }
  }
  return (
    <li className="card partner-booking" data-waiting={waiting || undefined}>
      <div className="partner-booking-head">
        <div>
          <h3>{b.title}</h3>
          <p className="muted">
            {b.orderReference}
            {showBusiness && b.businessName && ` · ${b.businessName}`}
          </p>
        </div>
        <span
          className="status-chip"
          data-tone={
            b.status === "CONFIRMED" || b.status === "COMPLETED"
              ? "ok"
              : waiting
                ? "wait"
                : undefined
          }
        >
          <Icon
            name={
              b.status === "CONFIRMED" ? "check" : waiting ? "clock" : "info"
            }
            size={14}
          />
          {partnerLabel(b)}
        </span>
      </div>
      <dl className="partner-booking-facts">
        <div>
          <dt>When</dt>
          <dd>
            {b.productType === "PACKAGE" ? "Departs " : ""}
            {shortDay(b.date)}
            {b.startTime && ` · ${clockLabel(b.startTime)}`}
          </dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{guests(b)}</dd>
        </div>
        <div>
          <dt>Lead guest</dt>
          <dd>
            {b.guest.name} ·{" "}
            <a href={`tel:${b.guest.phone}`}>{b.guest.phone}</a>
          </dd>
        </div>
        <div>
          <dt>You receive</dt>
          <dd>
            {formatMoney(b.partnerShareMinor)}
            {b.commissionBps
              ? ` (after ${b.commissionBps / 100}% commission)`
              : ""}
          </dd>
        </div>
      </dl>
      {waiting && b.partnerDeadline && (
        <p className="partner-booking-deadline">
          <Icon name="clock" size={16} />
          Answer by <strong>{lagosTime(b.partnerDeadline)}</strong>. If you
          don’t, it’s declined and the traveller is refunded.
        </p>
      )}
      {b.status === "DECLINED" && b.reason && (
        <p className="muted">Reason: {b.reason}</p>
      )}
      {waiting && (
        <fieldset className="partner-booking-actions" disabled={busy}>
          <legend className="sr-only">Answer this booking</legend>
          {declining ? (
            <>
              <label>
                Why can’t you take it? The traveller sees this.
                <input
                  autoFocus
                  maxLength={300}
                  value={reason}
                  placeholder="e.g. The boat is out of service that day"
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="danger"
                  disabled={reason.trim().length < 5}
                  onClick={() => decide("DECLINE")}
                >
                  Decline and refund
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setDeclining(false);
                    setReason("");
                  }}
                >
                  Back
                </button>
              </div>
            </>
          ) : (
            <div className="actions">
              <button type="button" onClick={() => decide("CONFIRM")}>
                {busy ? "Confirming…" : "Confirm booking"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDeclining(true)}
              >
                Can’t take it
              </button>
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      )}
    </li>
  );
}

// Paid bookings for a partner's listings (or, for staff, every partner's
// bookings still waiting). Waiting ones come first with their deadline.
export default function PartnerBookings({
  staff = false,
  onCount,
}: {
  staff?: boolean;
  // How many still need an answer, for the tab badge.
  onCount?: (waiting: number) => void;
}) {
  const url = staff
    ? "/api/v1/admin/partner-bookings"
    : "/api/v1/partner/bookings";
  const [list, setList] = useState<PartnerBookingView[] | null>(null),
    [error, setError] = useState("");
  const report = useCallback(
    (rows: PartnerBookingView[]) =>
      onCount?.(rows.filter((b) => b.status === "AWAITING_PARTNER").length),
    [onCount],
  );
  useEffect(() => {
    let active = true;
    call(url, "GET")
      .then((rows: PartnerBookingView[]) => {
        if (!active) return;
        setList(rows);
        report(rows);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [url, report]);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!list) return <p className="muted">Loading bookings…</p>;
  const waiting = list.filter((b) => b.status === "AWAITING_PARTNER");
  const rest = list.filter((b) => b.status !== "AWAITING_PARTNER");
  const done = (next: PartnerBookingView, message: string) => {
    const rows = list.map((b) => (b.id === next.id ? next : b));
    setList(rows);
    report(rows);
    showToast({ message });
  };
  const cards = (rows: PartnerBookingView[]) => (
    <ul className="partner-booking-list">
      {rows.map((b) => (
        <BookingCard
          key={`${b.id}-${b.version}`}
          b={b}
          url={url}
          showBusiness={staff}
          onDone={done}
        />
      ))}
    </ul>
  );

  return (
    <div className="partner-bookings">
      <section aria-labelledby="bookings-waiting">
        <h2 id="bookings-waiting">
          {staff ? "Waiting for partners" : "Needs your answer"} (
          {waiting.length})
        </h2>
        <p className="muted">
          {staff
            ? "Paid bookings partners haven’t answered yet. Confirm or decline for them if they reply by phone."
            : "Travellers have paid. Confirm each booking, or decline it if you can’t run it; they’re refunded in full."}
        </p>
        {waiting.length ? (
          cards(waiting)
        ) : (
          <p className="muted">Nothing waiting.</p>
        )}
      </section>
      {rest.length > 0 && (
        <section aria-labelledby="bookings-rest">
          <h2 id="bookings-rest">
            {staff ? "Declined, refund due" : "Upcoming and recent"}
          </h2>
          {cards(rest)}
        </section>
      )}
    </div>
  );
}
