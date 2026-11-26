"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { holdMinutes } from "@/modules/bookings/domain/checkout";
import type { Quote } from "@/modules/bookings/domain/cart";
import { ConfirmationChip, Totals, useCartView } from "./cart";
import { authClient } from "./auth-client";
import Icon from "./icons";
import { showToast } from "./toast";

type ApiError = { code: string; message: string; details?: unknown };

async function post<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ data?: T; error?: ApiError; status: number }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, data: json.data, error: json.error };
}

// Final review of the cart before paying. Each line is shown as the separate
// booking it will become, with its own terms and what happens after payment.
// The server's quote is the price paid: it is fetched on load and again on Pay.
export default function CheckoutReview({
  paymentsEnabled,
}: {
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { loading, lines, payable, views, totals } = useCartView();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const [tried, setTried] = useState(false);
  // One key per Pay press, kept when retrying the same press so the server
  // continues that checkout instead of holding places twice.
  const payKey = useRef("");

  const payableLines = payable.map((v) => v.line);
  const linesKey = JSON.stringify(payableLines);
  useEffect(() => {
    if (loading || !payableLines.length) return;
    let active = true;
    post<Quote>("/api/v1/cart/quote", { lines: JSON.parse(linesKey) })
      .then(({ data, error }) => {
        if (!active) return;
        if (data) {
          setQuote(data);
          setQuoteError("");
        } else
          setQuoteError(error?.message ?? "We couldn’t check prices. Retry.");
      })
      .catch(() => {
        if (active) setQuoteError("We couldn’t check prices. Retry.");
      });
    return () => {
      active = false;
    };
    // payableLines is recreated each render; linesKey is its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, linesKey]);

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

  const server = new Map(quote?.lines.map((l) => [l.id, l]));
  const ready = payable.filter((v) => quote && !server.get(v.line.id)?.problem);
  const skipped = views.length - ready.length;
  const leadName = name ?? session?.user.name ?? "";
  const phoneValid = /^\+?[0-9][0-9 ()-]{6,19}$/.test(phone.trim());
  const shownTotals = quote?.totals ?? totals;
  const problems = [
    leadName.trim().length < 2 && "Add the lead guest’s name.",
    !phoneValid && "Add a phone number partners can reach on the day.",
    !agreed && "Tick the box to agree to each booking’s terms.",
  ].filter((p): p is string => !!p);
  const canPay = paymentsEnabled && !!quote && ready.length > 0 && !paying;

  async function pay() {
    setTried(true);
    if (problems.length || !quote || !canPay) return;
    setPaying(true);
    setNotice("");
    payKey.current ||= crypto.randomUUID();
    try {
      const { data, error } = await post<
        | { status: "PAYMENT_REDIRECT"; authorizationUrl: string }
        | { status: "PAID"; orderReference: string }
      >(
        "/api/v1/checkouts",
        {
          lines: ready.map((v) => v.line),
          shownTotalMinor: quote.totals.totalMinor,
          contact: { name: leadName.trim(), phone: phone.trim() },
          agreed: true,
        },
        { "Idempotency-Key": payKey.current },
      );
      if (data?.status === "PAYMENT_REDIRECT") {
        showToast({ message: "Taking you to Paystack to pay…", pending: true });
        window.location.assign(data.authorizationUrl);
        return;
      }
      if (data?.status === "PAID") {
        router.push(`/bookings/${data.orderReference}?paid=1`);
        return;
      }
      const code = error?.code ?? "";
      // Retrying the same press is safe only when the provider didn't answer.
      if (code !== "PAYMENT_PROVIDER_UNAVAILABLE") payKey.current = "";
      const fresh = (error?.details as { quote?: Quote } | undefined)?.quote;
      if (fresh) setQuote(fresh);
      if (code === "PRICE_CHANGED" && fresh) {
        setAgreed(false);
        setNotice(
          `Prices changed: the total is now ${formatMoney(fresh.totals.totalMinor)}, was ${formatMoney(quote.totals.totalMinor)}. Check each booking and tick the box again.`,
        );
      } else if (code === "CAPACITY_UNAVAILABLE") {
        setNotice(error!.message);
        const again = await post<Quote>("/api/v1/cart/quote", {
          lines: payable.map((v) => v.line),
        });
        if (again.data) setQuote(again.data);
      } else setNotice(error?.message ?? "Payment couldn’t start. Try again.");
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
          <Link href="/cart">Cart</Link>
        </li>
        <li aria-current="step">Review and pay</li>
      </ol>
      <header className="page-intro">
        <p className="eyebrow">Checkout</p>
        <h1>Review and pay</h1>
        <p className="lede">
          One payment, {ready.length || payable.length} separate{" "}
          {(ready.length || payable.length) === 1 ? "booking" : "bookings"}.
          Each keeps its own date, guests, confirmation and cancellation terms.
        </p>
      </header>
      <div className="checkout-layout">
        <div className="checkout-main">
          {quote && skipped > 0 && (
            <div className="notice" role="alert">
              {skipped} {skipped === 1 ? "item can’t" : "items can’t"} be booked
              as {skipped === 1 ? "it is" : "they are"} and{" "}
              {skipped === 1 ? "isn’t" : "aren’t"} included.{" "}
              <Link href="/cart">Fix in cart</Link>
            </div>
          )}
          {quoteError && (
            <p className="field-error" role="alert">
              {quoteError}
            </p>
          )}
          <section className="checkout-section" aria-labelledby="contact-title">
            <h2 id="contact-title">Lead guest</h2>
            <div className="field-grid">
              <label className="field">
                <span>Name</span>
                <input
                  value={leadName}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Email (receipt goes here)</span>
                <input
                  type="email"
                  value={session?.user.email ?? ""}
                  readOnly
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span>Phone (for partners on the day)</span>
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
          </section>
          <section
            className="checkout-section"
            aria-labelledby="bookings-title"
          >
            <h2 id="bookings-title">Your bookings</h2>
            <ol className="checkout-lines">
              {payable.map((v, index) => {
                const q = server.get(v.line.id);
                return (
                  <li
                    key={v.line.id}
                    className="checkout-line card"
                    data-problem={!!q?.problem}
                  >
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
                    {q?.problem ? (
                      <p className="cart-line-problem" role="alert">
                        <Icon name="alert" size={16} />
                        {q.problem} It isn’t included in your total.
                      </p>
                    ) : (
                      q?.low && (
                        <p className="status-chip" data-tone="wait">
                          <Icon name="clock" size={14} />
                          {q.low}
                        </p>
                      )
                    )}
                    <dl className="booking-rows">
                      {(q?.rows ?? v.rows).map((row) => (
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
                );
              })}
            </ol>
          </section>
        </div>
        <aside className="checkout-pay" aria-labelledby="pay-title">
          <h2 id="pay-title">Pay and book</h2>
          <Totals totals={shownTotals} />
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I’ve checked each booking and agree to its cancellation terms.
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
            disabled={!canPay}
            aria-describedby="pay-note"
            onClick={pay}
          >
            <Icon name="lock" size={16} />
            {paying
              ? "Opening payment…"
              : `Pay ${formatMoney(shownTotals.totalMinor)}`}
          </button>
          <p id="pay-note" className="checkout-preview-note">
            <Icon name="info" size={14} />
            {paymentsEnabled
              ? `Your places are held for ${holdMinutes} minutes while you pay on the secure payment page. Test mode: no real money moves.`
              : "Payments aren’t switched on in this preview, so nothing can be held or charged yet."}
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
