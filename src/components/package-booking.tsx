"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  priceBasisText,
  seatLabels,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { shortDay } from "@/modules/catalogue/domain/schedule";
import {
  packageLinePrice,
  sumRows,
  type CartLine,
} from "@/modules/bookings/domain/cart";
import { useCart } from "@/hooks/use-cart";
import { showToast } from "./toast";
import Icon from "./icons";

type PackageLine = CartLine & { kind: "PACKAGE" };

export default function PackageBooking(props: {
  p: TripPackage;
  today: string;
  editId?: string;
}) {
  const { lines } = useCart();
  const editing = lines.find(
    (l): l is PackageLine =>
      l.id === props.editId &&
      l.kind === "PACKAGE" &&
      l.packageSlug === props.p.slug,
  );
  return <Panel key={editing?.id ?? "new"} {...props} editing={editing} />;
}

// Check dates for a ready-made trip: departure, travellers, rooms. Shares the
// booking panel layout, including the mobile bottom bar and sheet.
function Panel({
  p,
  today,
  editing,
}: {
  p: TripPackage;
  today: string;
  editing?: PackageLine;
}) {
  const router = useRouter();
  const cart = useCart();
  const formId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const departures = p.departures.filter((d) => d.date >= today);
  const [open, setOpen] = useState(!!editing);
  const [date, setDate] = useState(editing?.date ?? "");
  const [travellers, setTravellers] = useState(editing?.travellers ?? 2);
  const [singles, setSingles] = useState(editing?.singleRooms ?? 0);
  const [tried, setTried] = useState(false);
  const rows = packageLinePrice({ travellers, singleRooms: singles }, p);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  function commit() {
    setTried(true);
    if (!date) return null;
    const line = {
      kind: "PACKAGE" as const,
      packageSlug: p.slug,
      date,
      travellers,
      singleRooms: Math.min(singles, travellers),
    };
    if (editing) {
      cart.update(editing.id, line);
      return editing.id;
    }
    return cart.add(line);
  }
  return (
    <aside
      className="booking-panel card"
      data-open={open}
      aria-label={`Book ${p.title}`}
    >
      <div className="booking-bar">
        <p className="booking-from">
          <span>From</span>
          <strong>{formatMoney(p.priceMinor)}</strong>
          <span>{priceBasisText(p.priceBasis)}</span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen(true)}
        >
          {editing ? "Edit booking" : "Check dates"}
        </button>
      </div>
      <div className="booking-sheet" id={formId}>
        <div className="booking-sheet-head">
          <h2 ref={heading} tabIndex={-1}>
            {editing ? "Change your trip" : "Check dates"}
          </h2>
          <button
            type="button"
            className="icon-button booking-close"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" size={20} />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="booking-sheet-body">
          <p className="card-price booking-price">
            <strong>{formatMoney(p.priceMinor)}</strong>
            <span>{priceBasisText(p.priceBasis)}</span>
          </p>
          <ul className="booking-facts">
            <li data-tone="wait">
              <Icon name="clock" size={14} />
              Operator confirms within 48 h
            </li>
          </ul>
          <fieldset className="booking-field">
            <legend>Departure</legend>
            {departures.length ? (
              <div className="radio-stack">
                {departures.map((d) => (
                  <label className="check departure-option" key={d.date}>
                    <input
                      type="radio"
                      name={`${formId}-departure`}
                      checked={date === d.date}
                      disabled={d.seats === "FULL"}
                      onChange={() => setDate(d.date)}
                    />
                    <span>{shortDay(d.date)}</span>
                    <small data-seats={d.seats}>{seatLabels[d.seats]}</small>
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted">No upcoming departures listed.</p>
            )}
          </fieldset>
          <fieldset className="booking-field">
            <legend>Travellers</legend>
            <div className="stepper">
              <span className="stepper-label">Travellers</span>
              <span className="stepper-controls">
                <button
                  type="button"
                  className="icon-button secondary"
                  disabled={travellers <= 1}
                  onClick={() => setTravellers(travellers - 1)}
                >
                  <span aria-hidden="true">−</span>
                  <span className="sr-only">Fewer travellers</span>
                </button>
                <output aria-live="polite">{travellers}</output>
                <button
                  type="button"
                  className="icon-button secondary"
                  disabled={travellers >= 12}
                  onClick={() => setTravellers(travellers + 1)}
                >
                  <Icon name="plus" size={16} />
                  <span className="sr-only">More travellers</span>
                </button>
              </span>
            </div>
            <div className="stepper">
              <span className="stepper-label">
                Single rooms
                <small>+{formatMoney(p.singleSupplementMinor)} each</small>
              </span>
              <span className="stepper-controls">
                <button
                  type="button"
                  className="icon-button secondary"
                  disabled={singles <= 0}
                  onClick={() => setSingles(singles - 1)}
                >
                  <span aria-hidden="true">−</span>
                  <span className="sr-only">Fewer single rooms</span>
                </button>
                <output aria-live="polite">{singles}</output>
                <button
                  type="button"
                  className="icon-button secondary"
                  disabled={singles >= travellers}
                  onClick={() => setSingles(singles + 1)}
                >
                  <Icon name="plus" size={16} />
                  <span className="sr-only">More single rooms</span>
                </button>
              </span>
            </div>
          </fieldset>
          <dl className="booking-rows">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{formatMoney(row.totalMinor)}</dd>
              </div>
            ))}
            <div className="booking-rows-total">
              <dt>Total for this trip</dt>
              <dd>{formatMoney(sumRows(rows))}</dd>
            </div>
          </dl>
          {tried && !date && (
            <p className="field-error" role="alert">
              Choose a departure.
            </p>
          )}
          <p className="sample-note">
            <Icon name="info" size={16} />
            Sample trip and prices. Nothing is held or charged in this preview.
          </p>
        </div>
        <div className="booking-sheet-actions">
          {editing ? (
            <button
              type="button"
              onClick={() => {
                if (commit()) router.push("/cart");
              }}
            >
              Update cart
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (commit()) router.push("/checkout");
                }}
              >
                Book now
              </button>
              <button
                type="button"
                className="secondary"
                disabled={cart.full}
                onClick={() => {
                  if (!commit()) return;
                  setOpen(false);
                  showToast({
                    message: `${p.title} added to cart for ${shortDay(date)}.`,
                    href: "/cart",
                    action: "View cart",
                  });
                }}
              >
                <Icon name="plus" size={16} />
                Add to cart
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
