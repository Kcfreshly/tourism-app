"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "./auth-client";
import type { Item, Services, assess } from "@/modules/trips/domain/planner";
import { stayLabel, type Profile } from "@/modules/trips/domain/profile";
import { unplannedDays } from "@/modules/trips/domain/checkout";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import rules from "../../tourism-v1-handoff/data/pricing.demo.json";
import TripCost from "./trip-cost";
import Icon from "./icons";

type Workspace = {
  trip: {
    id: string;
    version: number;
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

// Final review before paying for a planned trip: one payment for its
// activities, cars and guides. Activities are held while the traveller
// pays; drivers and guides are matched afterwards.
export default function Checkout({
  id,
  paymentsEnabled,
}: {
  id: string;
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");
  // One key per Pay press, kept only when retrying after the provider failed.
  const payKey = useRef("");
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
  const pickup = price.warnings.find((w) => w.code === "PICKUP_ADDRESS");
  const leadName = name ?? session?.user.name ?? "";
  const phoneValid = /^\+?[0-9][0-9 ()-]{6,19}$/.test(phone.trim());
  const problems = [
    leadName.trim().length < 2 && "Add the lead guest’s name.",
    !phoneValid && "Add a phone number your driver can reach.",
    !agreed && "Tick the box to agree to the terms.",
  ].filter((p): p is string => !!p);

  async function pay() {
    setTried(true);
    if (problems.length || blocked || !paymentsEnabled || paying) return;
    setPaying(true);
    setNotice("");
    payKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch(
        `/api/v1/trips/${encodeURIComponent(id)}/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": payKey.current,
          },
          body: JSON.stringify({
            expectedVersion: trip.version,
            shownTotalMinor: price.totalMinor,
            contact: { name: leadName.trim(), phone: phone.trim() },
            agreed: true,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (body.data?.status === "PAYMENT_REDIRECT") {
        window.location.assign(body.data.authorizationUrl);
        return;
      }
      if (body.data?.status === "PAID") {
        router.push(`/bookings/${body.data.orderReference}?paid=1`);
        return;
      }
      if (body.error?.code !== "PAYMENT_PROVIDER_UNAVAILABLE")
        payKey.current = "";
      setNotice(body.error?.message ?? "Payment couldn’t start. Try again.");
    } catch {
      setNotice(
        "We couldn’t reach Fastlife. Check your connection and press Pay again.",
      );
    } finally {
      setPaying(false);
    }
  }

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
          in {stayLabel(profile)}
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
          {pickup && (
            <div className="notice pickup-reminder">
              <Icon name="pin" size={18} />
              <div>
                <strong>Pickup address needed</strong>
                <p>
                  {pickup.message}{" "}
                  <Link href={`/trips/${id}/profile#accommodation`}>
                    Add it now
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
              Your activity places are held for {rules.holdMinutes} minutes
              while you pay.
            </li>
            <li>
              Each activity, driver and guide is confirmed on its own, at these
              prices. You’ll see each one’s status in My bookings.
            </li>
            <li>
              We match your driver and guide and send their details at least 48
              hours before they start. If we can’t, that part is refunded in
              full.
            </li>
          </ol>
          <div className="field-grid checkout-contact">
            <label className="field">
              <span>Lead guest</span>
              <input
                value={leadName}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Phone (for your driver and guide)</span>
              <input
                type="tel"
                value={phone}
                autoComplete="tel"
                placeholder="+234 …"
                aria-invalid={tried && !phoneValid}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I’ve checked my days and agree to each activity’s cancellation
            policy.
          </label>
          {notice && (
            <p className="field-error" role="alert">
              {notice}
            </p>
          )}
          {tried && problems.length > 0 && (
            <ul className="field-error booking-problems" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={blocked || !paymentsEnabled || paying}
            aria-describedby="pay-preview-note"
            onClick={pay}
          >
            <Icon name="lock" size={16} />
            {paying ? "Opening payment…" : `Pay ${money(price.totalMinor)}`}
          </button>
          <p id="pay-preview-note" className="checkout-preview-note">
            <Icon name="info" size={14} />
            {blocked
              ? "Sort out the items above first."
              : paymentsEnabled
                ? "One payment on the secure payment page. Test mode: no real money moves."
                : "Payments aren’t switched on in this preview, so nothing can be held or charged yet."}
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
