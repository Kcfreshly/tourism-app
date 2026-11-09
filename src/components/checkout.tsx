"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Item, Services, assess } from "@/modules/trips/domain/planner";
import type { Profile } from "@/modules/trips/domain/profile";
import { unplannedDays } from "@/modules/trips/domain/checkout";
import {
  formatMoney,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import rules from "../../tourism-v1-handoff/data/pricing.demo.json";
import TripCost from "./trip-cost";
import Icon from "./icons";

type Workspace = {
  trip: {
    id: string;
    profile: Profile;
    items: Item[];
    services: Services;
  };
  price: ReturnType<typeof assess>;
};

const money = (n: number) => formatMoney(n, n % 100 ? 2 : 0);
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function friendly(message: string) {
  return message.replace(
    /^(\d{4}-\d{2}-\d{2}):\s*/,
    (_, date: string) => `${shortDate(date)}: `,
  );
}

// Final review before paying. Payment is not connected in this preview, so the
// pay button stays disabled and explains why; nothing is held or charged.
export default function Checkout({ id }: { id: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/trips/${encodeURIComponent(id)}/workspace`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error?.message);
        if (active) setData(body.data);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error && e.message
              ? e.message
              : "We couldn’t load your trip. Please retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (!data)
    return (
      <section className="page-status">
        {!error && <div className="spinner" aria-hidden="true" />}
        <p role="status">{error || "Loading your trip…"}</p>
        <Link className="text-link" href={`/trips/${id}/plan`}>
          Back to planner
        </Link>
      </section>
    );
  const { trip, price } = data;
  const { profile } = trip;
  const empty = unplannedDays(profile, trip.items);
  const planned = trip.items.some((i) => i.kind === "EXPERIENCE");
  const blocked = price.blockers.length > 0 || !planned;
  return (
    <section className="page checkout-page">
      <ol className="journey-steps checkout-steps" aria-label="Booking steps">
        <li data-done="true">
          <Link href={`/trips/${id}/plan`}>Plan your days</Link>
        </li>
        <li data-done="true">
          <Link href={`/trips/${id}/services`}>Choose services</Link>
        </li>
        <li aria-current="step">Review and pay</li>
      </ol>
      <header className="page-intro">
        <p className="eyebrow">Checkout</p>
        <h1>Review your trip</h1>
        <p className="lede">
          {profile.draftName || "Your Lagos trip"} ·{" "}
          {shortDate(profile.startDate)} – {shortDate(profile.endDate)} ·{" "}
          {profile.adults} {profile.adults === 1 ? "adult" : "adults"} · staying
          in{" "}
          {profile.accommodation ||
            (profile.zoneId !== "UNDECIDED"
              ? zoneLabel(profile.zoneId)
              : "a base not yet set")}
        </p>
      </header>
      <div className="checkout-layout">
        <div className="checkout-main">
          {empty.length > 0 && (
            <div className="notice checkout-free-days">
              <Icon name="calendar" size={18} />
              <div>
                <strong>
                  {empty.length} {empty.length === 1 ? "day is" : "days are"}{" "}
                  left free
                </strong>
                <p>
                  {empty.map(shortDate).join(", ")}. That’s fine — you can add
                  to them after booking.{" "}
                  <Link href={`/trips/${id}/plan?day=${empty[0]}`}>
                    Plan them now
                  </Link>
                </p>
              </div>
            </div>
          )}
          {blocked && (
            <div className="checkout-blockers" role="alert">
              <h2>
                <Icon name="alert" size={18} />
                Before you can pay
              </h2>
              <ul>
                {!planned && <li>Add at least one activity to your trip.</li>}
                {price.blockers.map((b, index) => (
                  <li key={index}>{friendly(b.message)}</li>
                ))}
              </ul>
              <div className="actions">
                <Link className="button secondary" href={`/trips/${id}/plan`}>
                  Fix in planner
                </Link>
                <Link
                  className="button secondary"
                  href={`/trips/${id}/services`}
                >
                  Fix services
                </Link>
                <Link
                  className="button secondary"
                  href={`/trips/${id}/profile`}
                >
                  Edit trip details
                </Link>
              </div>
            </div>
          )}
          <TripCost
            profile={profile}
            price={price}
            items={trip.items}
            expanded
          />
        </div>
        <aside className="checkout-pay" aria-labelledby="pay-title">
          <h2 id="pay-title">Pay and confirm</h2>
          <p className="checkout-total">
            <span>Total to pay</span>
            <strong>{money(price.totalMinor)}</strong>
          </p>
          <ol className="checkout-next">
            <li>
              Your places are held for {rules.holdMinutes} minutes while you
              pay.
            </li>
            <li>
              Payment confirms every activity, driver and guide at once, at
              these prices.
            </li>
            <li>
              You get your confirmation straight away, and your driver’s details
              48 hours before you arrive.
            </li>
          </ol>
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I’ve checked my days and agree to each activity’s cancellation
            policy.
          </label>
          <button type="button" disabled aria-describedby="pay-preview-note">
            <Icon name="lock" size={16} />
            Pay {money(price.totalMinor)}
          </button>
          <p id="pay-preview-note" className="checkout-preview-note">
            <Icon name="info" size={14} />
            {blocked
              ? "Sort out the items above first. "
              : agreed
                ? ""
                : "Tick the box above to continue. "}
            Payments aren’t switched on in this preview, so nothing can be held
            or charged yet.
          </p>
          <Link className="text-link" href={`/trips/${id}/plan`}>
            <Icon name="arrowLeft" size={16} />
            Back to planner
          </Link>
        </aside>
      </div>
    </section>
  );
}
