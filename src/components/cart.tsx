"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experience } from "@/modules/catalogue/domain/experience";
import {
  cancellationLabel,
  confirmationLabel,
  listingDetails,
} from "@/modules/catalogue/domain/listing-details";
import {
  displayName,
  formatMoney,
} from "@/modules/catalogue/domain/experience-content";
import { lagosToday } from "@/modules/catalogue/domain/events";
import { runsOn, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  packageBySlug,
  packageLength,
  packageRoute,
} from "@/modules/catalogue/domain/packages";
import {
  cartTotals,
  experienceLinePrice,
  packageLinePrice,
  sumRows,
  type CartLine,
  type PriceRow,
} from "@/modules/bookings/domain/cart";
import { useCart } from "@/hooks/use-cart";
import { useBucket } from "@/hooks/use-bucket";
import { loadCatalogue } from "./whats-on";
import { showToast } from "./toast";
import Icon from "./icons";

type Listing = Experience & { seedKey?: string };

// A cart line resolved against the catalogue, with what the traveller needs
// to see before paying. `problem` lines are excluded from the total.
export type LineView = {
  line: CartLine;
  title: string;
  image?: string;
  href: string;
  editHref: string;
  when: string;
  guests: string;
  where: string;
  confirmation: { instant: boolean; label: string; after: string };
  terms: string;
  rows: PriceRow[];
  totalMinor: number;
  problem?: string;
  saveId?: string;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function view(line: CartLine, catalogue: Listing[], today: string): LineView {
  if (line.kind === "PACKAGE") {
    const p = packageBySlug(line.packageSlug);
    if (!p)
      return {
        line,
        title: "Ready-made trip",
        href: "/packages",
        editHref: "/packages",
        when: shortDay(line.date),
        guests: plural(line.travellers, "traveller", "travellers"),
        where: "",
        confirmation: { instant: false, label: "", after: "" },
        terms: "",
        rows: [],
        totalMinor: 0,
        problem: "This trip is no longer offered.",
      };
    const departure = p.departures.find((d) => d.date === line.date);
    const rows = packageLinePrice(line, p);
    return {
      line,
      title: p.title,
      href: `/packages/${p.slug}`,
      editHref: `/packages/${p.slug}?edit=${line.id}`,
      when: `Departs ${shortDay(line.date)} · ${packageLength(p)}`,
      guests: plural(line.travellers, "traveller", "travellers"),
      where: `${packageRoute(p)} · run by ${p.operator}`,
      confirmation: {
        instant: false,
        label: "Operator confirms within 48 h",
        after: "The operator confirms your places within 48 hours.",
      },
      terms: p.bookingTerms[1] ?? p.bookingTerms[0],
      rows,
      totalMinor: sumRows(rows),
      problem:
        !departure || departure.seats === "FULL" || line.date < today
          ? "This departure is no longer available."
          : undefined,
    };
  }
  const e = catalogue.find((x) => x.offer.id === line.offerId);
  const when = `${shortDay(line.date)} · ${line.time}`;
  const guests = [
    plural(line.adults, "adult", "adults"),
    line.children ? plural(line.children, "child", "children") : "",
  ]
    .filter(Boolean)
    .join(", ");
  if (!e)
    return {
      line,
      title: "Activity",
      href: "/explore",
      editHref: "/explore",
      when,
      guests,
      where: "",
      confirmation: { instant: false, label: "", after: "" },
      terms: "",
      rows: [],
      totalMinor: 0,
      problem: "This activity is no longer listed.",
    };
  const d = listingDetails(e);
  const rows = experienceLinePrice(line, e.offer, d);
  const slug = e.seedKey ?? e.id;
  const instant = d.confirmation === "INSTANT";
  return {
    line,
    title: displayName(e.name),
    image: e.imagePath,
    href: `/experiences/${slug}`,
    editHref: `/experiences/${slug}?edit=${line.id}`,
    when,
    guests,
    where: line.pickup
      ? `Pickup from ${line.pickupAddress}`
      : `Make your own way · ${d.venue}`,
    confirmation: {
      instant,
      label: confirmationLabel(d),
      after: instant
        ? "Confirmed as soon as you pay."
        : `${d.operator.replace(/ \(sample.*\)$/, "")} confirms within ${d.partnerHours} hours. If they can’t, this item is refunded.`,
    },
    terms: cancellationLabel(d),
    rows,
    totalMinor: sumRows(rows),
    saveId: e.offer.id,
    problem:
      line.date < today || !runsOn(e, line.date)
        ? `No longer runs on ${shortDay(line.date)}.`
        : undefined,
  };
}

// Resolves the browser cart against the published catalogue.
export function useCartView() {
  const { lines, remove } = useCart();
  const [catalogue, setCatalogue] = useState<Listing[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadCatalogue()
      .then((data) => {
        if (active) setCatalogue(data);
      })
      .catch(() => {
        if (active) {
          setCatalogue([]);
          setError("We couldn’t load activity details. Please retry.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const today = lagosToday();
  const views = catalogue ? lines.map((l) => view(l, catalogue, today)) : [];
  const payable = views.filter((v) => !v.problem);
  return {
    loading: !catalogue,
    error,
    lines,
    views,
    payable,
    totals: cartTotals(payable.map((v) => v.totalMinor)),
    remove,
  };
}

export function CartNav() {
  const { lines } = useCart();
  return (
    <Link className="cart-pill" href="/cart" data-empty={!lines.length}>
      <Icon name="bag" size={18} />
      <span className="cart-pill-label">Cart</span>
      <span
        className="cart-count"
        aria-label={`${lines.length} ${lines.length === 1 ? "item" : "items"} in cart`}
      >
        {lines.length}
      </span>
    </Link>
  );
}

export function ConfirmationChip({ v }: { v: LineView }) {
  if (!v.confirmation.label) return null;
  return (
    <span
      className="status-chip"
      data-tone={v.confirmation.instant ? "ok" : "wait"}
    >
      <Icon name={v.confirmation.instant ? "check" : "clock"} size={14} />
      {v.confirmation.label}
    </span>
  );
}

function LineCard({ v, onRemove }: { v: LineView; onRemove: () => void }) {
  const { ids, toggle } = useBucket();
  return (
    <li className="cart-line card" data-problem={!!v.problem}>
      <div className="cart-line-media">
        {v.image ? (
          <img src={v.image} alt="" loading="lazy" />
        ) : (
          <span className="cart-line-cover" aria-hidden="true">
            <Icon name="compass" size={28} />
          </span>
        )}
      </div>
      <div className="cart-line-body">
        <h2>
          <Link href={v.href}>{v.title}</Link>
        </h2>
        <p className="cart-line-when">
          <Icon name="calendar" size={14} />
          {v.when} · {v.guests}
        </p>
        {v.where && (
          <p className="cart-line-where">
            <Icon name="pin" size={14} />
            {v.where}
          </p>
        )}
        {v.problem ? (
          <div className="cart-line-problem" role="alert">
            <p>
              <Icon name="alert" size={16} />
              {v.problem} It isn’t included in your total.
            </p>
            <div className="actions">
              <Link className="button secondary" href={v.editHref}>
                Choose another date
              </Link>
              {v.saveId && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    if (!ids.includes(v.saveId!)) toggle(v.saveId!);
                    onRemove();
                  }}
                >
                  Save to Bucket
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="cart-line-status">
              <ConfirmationChip v={v} />
            </p>
            <p className="cart-line-terms">{v.terms}</p>
          </>
        )}
      </div>
      <div className="cart-line-side">
        {!v.problem && (
          <p className="cart-line-price">{formatMoney(v.totalMinor)}</p>
        )}
        <div className="cart-line-actions">
          {!v.problem && (
            <Link className="text-button" href={v.editHref}>
              Edit
            </Link>
          )}
          {!v.problem && v.saveId && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (!ids.includes(v.saveId!)) toggle(v.saveId!);
                onRemove();
                showToast({
                  message: `${v.title} moved to your Bucket.`,
                  href: "/explore?view=bucket",
                  action: "View Bucket",
                });
              }}
            >
              Save for later
            </button>
          )}
          <button
            type="button"
            className="text-button danger-text"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function Totals({ totals }: { totals: ReturnType<typeof cartTotals> }) {
  return (
    <dl className="cart-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatMoney(totals.subtotalMinor)}</dd>
      </div>
      <div>
        <dt>Service fee</dt>
        <dd>{formatMoney(totals.feeMinor)}</dd>
      </div>
      <div className="cart-totals-total">
        <dt>Total</dt>
        <dd>{formatMoney(totals.totalMinor)}</dd>
      </div>
    </dl>
  );
}

export default function CartPage() {
  const { loading, error, lines, views, payable, totals, remove } =
    useCartView();
  if (!lines.length)
    return (
      <section className="page cart-page">
        <header className="page-intro">
          <h1>Your cart</h1>
        </header>
        <div className="empty-state">
          <Icon name="bag" size={28} />
          <h2>Your cart is empty</h2>
          <p>
            Things you choose to book, with a date and guests, appear here.
            Ideas you save live in your Bucket.
          </p>
          <div className="actions">
            <Link className="button" href="/explore">
              Find things to do
            </Link>
            <Link className="button secondary" href="/explore?view=bucket">
              Open your Bucket
            </Link>
          </div>
        </div>
      </section>
    );
  return (
    <section className="page cart-page">
      <header className="page-intro">
        <h1>Your cart</h1>
        <p className="lede">
          {plural(lines.length, "item", "items")}. Each item is booked
          separately, with its own date, guests and terms.
        </p>
      </header>
      {loading ? (
        <p role="status">Loading your cart…</p>
      ) : (
        <div className="cart-layout">
          <div>
            {error && <p className="field-error">{error}</p>}
            <ul className="cart-lines">
              {views.map((v) => (
                <LineCard
                  key={v.line.id}
                  v={v}
                  onRemove={() => remove(v.line.id)}
                />
              ))}
            </ul>
            <Link className="text-link" href="/explore">
              <Icon name="plus" size={16} />
              Add more things to do
            </Link>
          </div>
          <aside
            className="cart-summary card"
            aria-labelledby="cart-summary-title"
          >
            <h2 id="cart-summary-title">Summary</h2>
            <Totals totals={totals} />
            {payable.length < views.length && (
              <p className="muted">
                {plural(
                  views.length - payable.length,
                  "item needs",
                  "items need",
                )}{" "}
                attention and{" "}
                {views.length - payable.length === 1 ? "isn’t" : "aren’t"}{" "}
                included.
              </p>
            )}
            {payable.length > 0 ? (
              <Link className="button" href="/checkout">
                Review and checkout
                <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <button type="button" disabled>
                Review and checkout
              </button>
            )}
            <p className="sample-note">
              <Icon name="info" size={16} />
              Preview: sample prices. Nothing is held or charged.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
