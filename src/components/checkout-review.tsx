"use client";
import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { ConfirmationChip, Totals, useCartView } from "./cart";
import { authClient } from "./auth-client";
import Icon from "./icons";

// Final review of the cart before paying. Each line is shown as the separate
// booking it will become, with its own terms and what happens after payment.
// Payment is not connected in the preview, so the pay button stays disabled.
export default function CheckoutReview() {
  const { data: session } = authClient.useSession();
  const { loading, lines, payable, views, totals } = useCartView();
  const [agreed, setAgreed] = useState(false);
  const [phone, setPhone] = useState("");
  if (!lines.length)
    return (
      <section className="page checkout-page">
        <div className="empty-state">
          <Icon name="bag" size={28} />
          <h1>Nothing to check out</h1>
          <p>Your cart is empty.</p>
          <Link className="button" href="/explore">
            Find things to do
          </Link>
        </div>
      </section>
    );
  if (loading)
    return (
      <section className="page-status">
        <div className="spinner" aria-hidden="true" />
        <p role="status">Loading your cart…</p>
      </section>
    );
  const skipped = views.length - payable.length;
  return (
    <section className="page checkout-page">
      <ol className="journey-steps checkout-steps" aria-label="Booking steps">
        <li data-done="true">
          <Link href="/cart">Cart</Link>
        </li>
        <li aria-current="step">Review and pay</li>
      </ol>
      <header className="page-intro">
        <p className="eyebrow">Checkout</p>
        <h1>Review and pay</h1>
        <p className="lede">
          One payment, {payable.length} separate{" "}
          {payable.length === 1 ? "booking" : "bookings"}. Each keeps its own
          date, guests, confirmation and cancellation terms.
        </p>
      </header>
      <div className="checkout-layout">
        <div className="checkout-main">
          {skipped > 0 && (
            <div className="notice" role="alert">
              {skipped} {skipped === 1 ? "item isn’t" : "items aren’t"}{" "}
              available any more and {skipped === 1 ? "isn’t" : "aren’t"}{" "}
              included. <Link href="/cart">Fix in cart</Link>
            </div>
          )}
          <section className="checkout-section" aria-labelledby="contact-title">
            <h2 id="contact-title">Lead guest</h2>
            <div className="field-grid">
              <label className="field">
                <span>Name</span>
                <input
                  defaultValue={session?.user.name ?? ""}
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  defaultValue={session?.user.email ?? ""}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span>Phone (for partners on the day)</span>
                <input
                  type="tel"
                  value={phone}
                  autoComplete="tel"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>
          </section>
          <section
            className="checkout-section"
            aria-labelledby="bookings-title"
          >
            <h2 id="bookings-title">Your bookings</h2>
            <ol className="checkout-lines">
              {payable.map((v, index) => (
                <li key={v.line.id} className="checkout-line card">
                  <div className="checkout-line-head">
                    <span className="checkout-line-number">
                      Booking {index + 1}
                    </span>
                    <ConfirmationChip v={v} />
                  </div>
                  <h3>{v.title}</h3>
                  <p className="cart-line-when">
                    <Icon name="calendar" size={14} />
                    {v.when} · {v.guests}
                  </p>
                  <p className="cart-line-where">
                    <Icon name="pin" size={14} />
                    {v.where}
                  </p>
                  <dl className="booking-rows">
                    {v.rows.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{formatMoney(row.totalMinor)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="checkout-line-after">
                    <strong>After you pay:</strong> {v.confirmation.after}
                  </p>
                  <p className="checkout-line-terms">
                    <strong>Cancellation:</strong> {v.terms}
                  </p>
                  <Link className="text-button" href={v.editHref}>
                    Change
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="checkout-pay" aria-labelledby="pay-title">
          <h2 id="pay-title">Pay and confirm</h2>
          <Totals totals={totals} />
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I’ve checked each booking and agree to its cancellation terms.
          </label>
          <button type="button" disabled aria-describedby="pay-preview-note">
            <Icon name="lock" size={16} />
            Pay {formatMoney(totals.totalMinor)}
          </button>
          <p id="pay-preview-note" className="checkout-preview-note">
            <Icon name="info" size={14} />
            {agreed ? "" : "Tick the box above to continue. "}
            Payments aren’t switched on in this preview, so nothing can be held
            or charged yet.
          </p>
          <Link className="text-link" href="/cart">
            <Icon name="arrowLeft" size={16} />
            Back to cart
          </Link>
        </aside>
      </div>
    </section>
  );
}
