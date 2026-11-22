"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Experience } from "@/modules/catalogue/domain/experience";
import {
  ageLabel,
  arrivalLabel,
  confirmationLabel,
  type ListingDetails,
} from "@/modules/catalogue/domain/listing-details";
import {
  formatDuration,
  formatMoney,
  priceBasisLabel,
} from "@/modules/catalogue/domain/experience-content";
import {
  nextRunDates,
  rangeDays,
  rangeText,
  runsOn,
  shortDay,
  shortestVisit,
  clockLabel,
  startTimesOn,
} from "@/modules/catalogue/domain/schedule";
import {
  experienceLinePrice,
  sumRows,
  type CartLine,
} from "@/modules/bookings/domain/cart";
import { eventDates, isEvent } from "@/modules/catalogue/domain/events";
import { useCart } from "@/hooks/use-cart";
import { BucketButton } from "./bucket";
import AddToTrip from "./add-to-trip";
import { showToast } from "./toast";
import Icon from "./icons";

type Listing = Experience & { seedKey: string };
const minutesOf = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const clockOf = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
type ExperienceLine = CartLine & { kind: "EXPERIENCE" };

// Wraps the panel so that editing a cart line remounts it with that line's
// choices once the browser cart has loaded.
export default function BookingPanel(props: {
  experience: Listing;
  details: ListingDetails;
  today: string;
  // The page's clock, so today only offers starts that can still be booked.
  now: number;
  // From the transport settings: a visit ending at or after this time asks
  // the traveller to confirm they'll get back on their own.
  lateReturnFrom: string;
  initialDate?: string;
  // The dates of a visit, from browsing: the date chips stay inside it.
  visit?: { from: string; to: string };
  editId?: string;
  startOpen?: boolean;
}) {
  const { lines } = useCart();
  const editing = lines.find(
    (l): l is ExperienceLine =>
      l.id === props.editId &&
      l.kind === "EXPERIENCE" &&
      l.offerId === props.experience.offer.id,
  );
  return (
    <Panel
      key={editing?.id ?? "new"}
      {...props}
      editing={editing}
      startOpen={props.startOpen || !!editing}
    />
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="stepper-controls">
        <button
          type="button"
          className="icon-button secondary"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <span aria-hidden="true">−</span>
          <span className="sr-only">Fewer {label.toLowerCase()}</span>
        </button>
        <output aria-live="polite">{value}</output>
        <button
          type="button"
          className="icon-button secondary"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Icon name="plus" size={16} />
          <span className="sr-only">More {label.toLowerCase()}</span>
        </button>
      </span>
    </div>
  );
}

function Panel({
  experience: e,
  details,
  today,
  now,
  lateReturnFrom,
  initialDate,
  visit,
  editing,
  startOpen = false,
}: {
  experience: Listing;
  details: ListingDetails;
  today: string;
  now: number;
  lateReturnFrom: string;
  initialDate?: string;
  visit?: { from: string; to: string };
  editing?: ExperienceLine;
  startOpen?: boolean;
}) {
  const router = useRouter();
  const cart = useCart();
  const formId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const name = e.name.replace(/\s*[—-]\s*DEMO$/, "");
  // A dated event only runs on its listed dates, so those are the only
  // choices and the earliest is picked for the traveller.
  const dated = isEvent(e);
  const eventDays = dated
    ? eventDates(e, today).filter((d) => runsOn(e, d, now))
    : [];
  const visitDays =
    visit && !dated
      ? rangeDays(visit.from, visit.to).filter(
          (d) => d >= today && runsOn(e, d, now),
        )
      : [];
  const upcoming = dated
    ? eventDays
    : visitDays.length
      ? visitDays.slice(0, 6)
      : nextRunDates(e, today, 4, now);
  // A date chosen elsewhere (a card, an edit) stays visible as a chip.
  const chips = (d: string) =>
    d && !upcoming.includes(d) && runsOn(e, d) ? [...upcoming, d] : upcoming;
  const [open, setOpen] = useState(startOpen);
  const [date, setDate] = useState(
    editing?.date ??
      (initialDate && runsOn(e, initialDate) ? initialDate : eventDays[0]) ??
      "",
  );
  const times = date ? startTimesOn(e, date, now) : [];
  // Runs that day, but every start is already inside the booking cutoff.
  const tooLate = !!date && !times.length && runsOn(e, date);
  const dropIn = shortestVisit(e) < e.durationMinMinutes;
  const [chosenTime, setTime] = useState(editing?.time ?? "");
  const time = times.includes(chosenTime)
    ? chosenTime
    : times.length === 1
      ? times[0]
      : "";
  // When the visit ends: the session's length, or the listed shortest visit.
  const endsAt = time
    ? clockOf(
        minutesOf(time) +
          (e.sessions?.find((s) => s.startTime === time)?.durationMinutes ??
            e.durationMinMinutes),
      )
    : "";
  const lateReturn = !!endsAt && endsAt >= lateReturnFrom;
  const [ownWayBack, setOwnWayBack] = useState(!!editing);
  const kids = details.minAge < 18;
  const [adults, setAdults] = useState(
    editing?.adults ?? Math.max(1, e.offer.minParty),
  );
  const [children, setChildren] = useState(editing?.children ?? 0);
  // "" until chosen; one entry per child.
  const [ages, setAges] = useState<(number | "")[]>(editing?.childAges ?? []);
  const childAges = Array.from({ length: children }, (_, i) => ages[i] ?? "");
  const youngest = Math.max(details.minAge, 0);
  const [pickup, setPickup] = useState(
    editing?.pickup ?? details.arrival === "PICKUP_REQUIRED",
  );
  const [address, setAddress] = useState(editing?.pickupAddress ?? "");
  const [tried, setTried] = useState(false);
  const guests = adults + children;
  const needsAddress = pickup || details.arrival === "PICKUP_REQUIRED";
  const rows = experienceLinePrice(
    { adults, children, pickup: pickup && details.arrival !== "SELF" },
    e.offer,
    details,
  );
  const problems = [
    !date && (dated ? "This event has no upcoming dates." : "Choose a date."),
    date &&
      !times.length &&
      (tooLate
        ? `Too late to book for ${shortDay(date)}.`
        : `This doesn’t run on ${shortDay(date)}.`),
    times.length > 0 && !time && "Choose a start time.",
    guests < e.offer.minParty && `At least ${e.offer.minParty} guests.`,
    guests > e.offer.maxParty && `At most ${e.offer.maxParty} guests.`,
    childAges.some((a) => a === "") && "Add each child’s age.",
    needsAddress && !address.trim() && "Add the pickup address.",
    lateReturn && !ownWayBack && "Confirm how you’ll get back.",
  ].filter((p): p is string => !!p);
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
    if (problems.length) return null;
    const line = {
      kind: "EXPERIENCE" as const,
      offerId: e.offer.id,
      date,
      time,
      adults,
      children,
      childAges: childAges.filter((a): a is number => a !== ""),
      pickup: needsAddress,
      pickupAddress: needsAddress ? address.trim() : "",
    };
    if (editing) {
      cart.update(editing.id, line);
      return editing.id;
    }
    return cart.add(line);
  }
  function addToCart() {
    if (!commit()) return;
    if (editing) router.push("/cart");
    else
      showToast({
        message: `${name} added to cart for ${shortDay(date)}.`,
        href: "/cart",
        action: "View cart",
      });
    setOpen(false);
  }
  function bookNow() {
    if (commit()) router.push("/checkout");
  }
  return (
    <aside
      className="booking-panel card"
      data-open={open}
      aria-label={`Book ${name}`}
    >
      <div className="booking-bar">
        <p className="booking-from">
          <span>From</span>
          <strong>{formatMoney(e.offer.rateMinor)}</strong>
          <span>{priceBasisLabel(e.offer.priceBasis)}</span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen(true)}
        >
          {editing ? "Edit booking" : "Choose date"}
        </button>
      </div>
      <div className="booking-sheet" id={formId}>
        <div className="booking-sheet-head">
          <h2 ref={heading} tabIndex={-1}>
            {editing ? "Change your booking" : "Choose date and guests"}
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
            <strong>{formatMoney(e.offer.rateMinor)}</strong>
            <span>{priceBasisLabel(e.offer.priceBasis)}</span>
          </p>
          <ul className="booking-facts">
            <li data-tone={details.confirmation === "INSTANT" ? "ok" : "wait"}>
              <Icon
                name={details.confirmation === "INSTANT" ? "check" : "clock"}
                size={14}
              />
              {confirmationLabel(details)}
            </li>
            <li>
              <Icon name="users" size={14} />
              {ageLabel(details)}
            </li>
          </ul>
          <fieldset className="booking-field">
            <legend>Date</legend>
            {visitDays.length > 0 && (
              <p className="muted">
                Runs on {visitDays.length}{" "}
                {visitDays.length === 1 ? "day" : "days"} of your visit,{" "}
                {rangeText(visit!.from, visit!.to)}.
              </p>
            )}
            {dated && (
              <p className="muted">
                {!eventDays.length
                  ? "No upcoming dates for this event."
                  : eventDays.length === 1
                    ? "This event runs on one date only."
                    : "This event runs on these dates only."}
              </p>
            )}
            <div className="chip-row">
              {chips(date).map((d) => (
                <button
                  type="button"
                  key={d}
                  className="chip"
                  aria-pressed={date === d}
                  onClick={() => setDate(d)}
                >
                  {shortDay(d)}
                </button>
              ))}
            </div>
            {!dated && (
              <label className="field booking-date">
                <span>Or pick a date</span>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            )}
            {date && !times.length && (
              <p className="field-error">
                {tooLate ? "Too late to book for" : "Doesn’t run on"}{" "}
                {shortDay(date)}.
                {upcoming[0] && ` Next: ${shortDay(upcoming[0])}.`}
              </p>
            )}
          </fieldset>
          {times.length > 0 && (
            <fieldset className="booking-field">
              <legend>Start time</legend>
              {dropIn && (
                <p className="muted">
                  Arrive when you like and stay from{" "}
                  {formatDuration(shortestVisit(e))} up to{" "}
                  {formatDuration(e.durationMaxMinutes)}. Leave by{" "}
                  {clockLabel(e.availabilityLocal.closesAt)}.
                </p>
              )}
              <div className="chip-row">
                {times.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className="chip"
                    aria-pressed={time === t}
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="booking-field">
            <legend>Guests</legend>
            <Stepper
              label="Adults"
              value={adults}
              min={1}
              max={e.offer.maxParty - children}
              onChange={setAdults}
            />
            {kids ? (
              <Stepper
                label="Children"
                hint={
                  details.minAge > 0 ? `Ages ${details.minAge}–17` : "Ages 0–17"
                }
                value={children}
                min={0}
                max={e.offer.maxParty - adults}
                onChange={setChildren}
              />
            ) : (
              <p className="muted">Adults only (18+).</p>
            )}
            {children > 0 && (
              <div className="child-ages">
                {childAges.map((age, i) => (
                  <label className="field" key={i}>
                    <span>Child {i + 1} age</span>
                    <select
                      value={age}
                      onChange={(event) => {
                        const next = [...childAges];
                        next[i] =
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value);
                        setAges(next);
                      }}
                    >
                      <option value="">Age</option>
                      {Array.from(
                        { length: 18 - youngest },
                        (_, n) => youngest + n,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? "Under 1" : n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="booking-field">
            <legend>Getting there</legend>
            {details.arrival === "PICKUP_OPTIONAL" ? (
              <div className="radio-stack">
                <label className="check">
                  <input
                    type="radio"
                    name={`${formId}-arrival`}
                    checked={!pickup}
                    onChange={() => setPickup(false)}
                  />
                  Make my own way to {details.venue}
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name={`${formId}-arrival`}
                    checked={pickup}
                    onChange={() => setPickup(true)}
                  />
                  Pick us up (+{formatMoney(details.pickupRateMinor)})
                </label>
              </div>
            ) : (
              <p className="muted">
                {arrivalLabel(details)}
                {details.arrival === "SELF" && ` · ${details.venue}`}
              </p>
            )}
            {needsAddress && (
              <label className="field">
                <span>Pickup address</span>
                <input
                  value={address}
                  autoComplete="street-address"
                  placeholder="Street, area"
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
            )}
            {lateReturn && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={ownWayBack}
                  onChange={(event) => setOwnWayBack(event.target.checked)}
                />
                This ends around {clockLabel(endsAt)}. We’ll arrange our own way
                back; Fastlife transport isn’t included with a single booking.
              </label>
            )}
          </fieldset>
          <dl className="booking-rows">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{formatMoney(row.totalMinor)}</dd>
              </div>
            ))}
            <div className="booking-rows-total">
              <dt>Total for this booking</dt>
              <dd>{formatMoney(sumRows(rows))}</dd>
            </div>
          </dl>
          {tried && problems.length > 0 && (
            <ul className="field-error booking-problems" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="sample-note">
            <Icon name="info" size={16} />
            Sample prices. Nothing is held or charged in this preview.
          </p>
        </div>
        <div className="booking-sheet-actions">
          {editing ? (
            <button type="button" onClick={addToCart}>
              Update cart
            </button>
          ) : (
            <>
              <button type="button" onClick={bookNow}>
                Book now
              </button>
              <button
                type="button"
                className="secondary"
                disabled={cart.full}
                onClick={addToCart}
              >
                <Icon name="plus" size={16} />
                Add to cart
              </button>
            </>
          )}
        </div>
        <div className="booking-more">
          <BucketButton id={e.offer.id} variant="compact" />
          <AddToTrip
            offerId={e.offer.id}
            title={name}
            date={date || undefined}
            className="text-button"
          />
        </div>
      </div>
    </aside>
  );
}
