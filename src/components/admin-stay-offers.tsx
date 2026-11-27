"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { addDays, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  maxOpenStayOffers,
  stayOpen,
  stayStatusLabel,
  type StayView,
} from "@/modules/bookings/domain/stay-offer";
import {
  linkSources,
  stayTypes,
  type Profile,
  type StayRequest,
} from "@/modules/trips/domain/profile";
import { zoneLabel } from "@/modules/catalogue/domain/experience-content";
import { showToast } from "./toast";

// Mirrors StayTripOrder from the API.
type TripOrder = {
  orderId: string;
  reference: string;
  paidAt: string;
  contact: { name: string; phone: string; email: string };
  from: string;
  to: string;
  offers: StayView[];
  request?: Pick<Profile, "adults" | "zoneId" | "startDate" | "endDate"> & {
    stay?: StayRequest;
  };
  respondBy?: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

// What the traveller asked for, as staff need it to find a place.
function StayRequestFacts({ order }: { order: TripOrder }) {
  const r = order.request!;
  const stay = r.stay;
  const choice = stay?.choice;
  const overdue =
    !!order.respondBy &&
    new Date(order.respondBy) <= new Date() &&
    !order.offers.some((x) => x.status !== "WITHDRAWN");
  return (
    <dl className="admin-service-facts">
      <div>
        <dt>Area</dt>
        <dd>{r.zoneId === "UNDECIDED" ? "Not chosen" : zoneLabel(r.zoneId)}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd>{stay ? stayTypes[stay.type] : "Not given"}</dd>
      </div>
      <div>
        <dt>Budget per night</dt>
        <dd>
          {stay?.budgetPerNightMinor !== undefined
            ? formatMoney(stay.budgetPerNightMinor)
            : "Flexible"}
        </dd>
      </div>
      <div>
        <dt>Dates and guests</dt>
        <dd>
          {shortDay(r.startDate)} – {shortDay(r.endDate)} · {r.adults}{" "}
          {r.adults === 1 ? "adult" : "adults"}
        </dd>
      </div>
      <div data-missing={choice?.kind === "NAMED" || undefined}>
        <dt>Their choice</dt>
        <dd>
          {!choice || choice.kind === "RECOMMEND" ? (
            "No preference: recommend"
          ) : choice.kind === "LISTED" ? (
            `${choice.name} (on our list)`
          ) : choice.kind === "NAMED" ? (
            `${choice.name} (typed, unverified)`
          ) : (
            <a
              href={choice.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {linkSources[choice.source]}
            </a>
          )}
        </dd>
      </div>
      {order.respondBy && (
        <div data-missing={overdue || undefined}>
          <dt>{overdue ? "Reply overdue since" : "Reply by"}</dt>
          <dd>{when(order.respondBy)}</dd>
        </div>
      )}
    </dl>
  );
}

async function call(method: "GET" | "POST" | "PATCH", body?: unknown) {
  const r = await fetch("/api/v1/admin/stay-offers", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data;
}

// A Lagos wall-clock time from <input type="datetime-local">, as an
// ISO time with the Lagos offset.
const lagosIso = (local: string) => `${local}:00+01:00`;

function SendOffer({
  order,
  onSent,
}: {
  order: TripOrder;
  onSent: () => void;
}) {
  const choice = order.request?.stay?.choice;
  const [propertyName, setName] = useState(
    choice?.kind === "LISTED" || choice?.kind === "NAMED" ? choice.name : "",
  );
  const [area, setArea] = useState(
    order.request && order.request.zoneId !== "UNDECIDED"
      ? zoneLabel(order.request.zoneId)
      : "",
  );
  const [address, setAddress] = useState("");
  const [room, setRoom] = useState("");
  const [checkIn, setCheckIn] = useState(order.from);
  const [checkOut, setCheckOut] = useState(
    order.to ? addDays(order.to, 1) : "",
  );
  const [price, setPrice] = useState("");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await call("POST", {
        orderReference: order.reference,
        propertyName,
        area,
        address,
        room,
        checkIn,
        checkOut,
        note,
        // Naira as typed; the API takes kobo.
        priceMinor: Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100),
        availableUntil: lagosIso(until),
      });
      showToast({ message: `Stay offer sent for ${order.reference}.` });
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-service-form" onSubmit={send}>
      <label className="field">
        <span>Property</span>
        <input
          required
          minLength={2}
          maxLength={120}
          value={propertyName}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Area</span>
        <input
          required
          minLength={2}
          maxLength={60}
          placeholder="Lekki"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </label>
      <label className="field admin-service-wide">
        <span>Address</span>
        <input
          required
          minLength={5}
          maxLength={300}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Room</span>
        <input
          required
          minLength={2}
          maxLength={120}
          placeholder="Deluxe double"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Check-in</span>
        <input
          required
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Check-out</span>
        <input
          required
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Price, all in (₦, markup included)</span>
        <input
          required
          inputMode="decimal"
          placeholder="180,000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Held until (Lagos time)</span>
        <input
          required
          type="datetime-local"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>
      <label className="field admin-service-wide">
        <span>Note for the traveller (optional)</span>
        <input
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p className="field-error admin-service-wide" role="alert">
          {error}
        </p>
      )}
      <div className="admin-save-actions">
        <button type="submit" disabled={busy}>
          Send offer
        </button>
      </div>
    </form>
  );
}

function Offer({
  offer,
  onChanged,
}: {
  offer: StayView;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const now = new Date();
  return (
    <li className="admin-stay-offer">
      <span>
        <strong>{offer.propertyName}</strong> · {offer.room} ·{" "}
        {shortDay(offer.checkIn)}–{shortDay(offer.checkOut)} ·{" "}
        {formatMoney(offer.priceMinor)}
      </span>
      <span className="admin-stay-offer-actions">
        <span
          className="status-chip"
          data-tone={
            offer.status === "BOOKED"
              ? "ok"
              : stayOpen(offer, now)
                ? "wait"
                : undefined
          }
        >
          {stayStatusLabel(offer, now)}
        </span>
        {offer.status === "OFFERED" && (
          <button
            type="button"
            className="text-button danger-text"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call("PATCH", {
                  action: "WITHDRAW",
                  id: offer.id,
                  expectedVersion: offer.version,
                });
                onChanged();
              } catch (e) {
                showToast({ message: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            Withdraw
          </button>
        )}
      </span>
    </li>
  );
}

// Staff send places to stay into paid trips. The traveller approves one and
// pays for it in the app; the others are released.
export default function AdminStayOffers() {
  const [orders, setOrders] = useState<TripOrder[] | null>(null);
  const [error, setError] = useState("");
  const [loads, setLoads] = useState(0);
  const [openFor, setOpenFor] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    call("GET")
      .then((data) => active && setOrders(data))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [loads]);
  const reload = () => setLoads((n) => n + 1);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!orders) return <p className="muted">Loading paid trips…</p>;
  if (!orders.length) return <p className="muted">No paid trips yet.</p>;
  return (
    <ul className="admin-services-list">
      {orders.map((o) => {
        const now = new Date();
        const booked = o.offers.some((x) => x.status === "BOOKED");
        const open = o.offers.filter((x) => stayOpen(x, now)).length;
        return (
          <li key={o.orderId} className="card admin-service">
            <div className="admin-service-head">
              <div>
                <h3>{o.reference}</h3>
                <p className="muted">
                  {o.from && `${shortDay(o.from)} – ${shortDay(o.to)} · `}
                  {o.contact.name},{" "}
                  <a href={`tel:${o.contact.phone}`}>{o.contact.phone}</a>
                </p>
              </div>
              <span
                className="status-chip"
                data-tone={booked ? "ok" : open ? "wait" : undefined}
              >
                {booked
                  ? "Stay booked"
                  : open
                    ? `${open} offer${open === 1 ? "" : "s"} open`
                    : o.request
                      ? "Stay requested"
                      : "No stay yet"}
              </span>
            </div>
            {o.request && <StayRequestFacts order={o} />}
            {o.offers.length > 0 && (
              <ul className="admin-stay-offers">
                {o.offers.map((x) => (
                  <Offer
                    key={`${x.id}:${x.version}`}
                    offer={x}
                    onChanged={reload}
                  />
                ))}
              </ul>
            )}
            {!booked &&
              (openFor === o.orderId ? (
                <SendOffer
                  order={o}
                  onSent={() => {
                    setOpenFor(null);
                    reload();
                  }}
                />
              ) : (
                <div className="admin-save-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={open >= maxOpenStayOffers}
                    onClick={() => setOpenFor(o.orderId)}
                  >
                    Send a stay offer
                  </button>
                </div>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
