"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { useCart } from "@/hooks/use-cart";
import Icon from "./icons";

type State = "PENDING" | "FAILED" | "REQUIRES_REVIEW" | "UNKNOWN";
const pollMs = 3000;
const pollFor = 2 * 60 * 1000;

// After the payment page: shows where the payment stands and, while it is
// still being confirmed, asks again every few seconds. Paid goes straight to
// the booking.
export function PaymentStatus({
  reference,
  initial,
}: {
  reference: string;
  initial: State;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(initial);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (state !== "PENDING") return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await fetch("/api/v1/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const data = (await response.json()).data as
          | { status: "PAID"; orderReference: string }
          | { status: State }
          | undefined;
        if (data?.status === "PAID") {
          router.replace(`/bookings/${data.orderReference}?paid=1`);
          return;
        }
        if (data && data.status !== "PENDING") {
          setState(data.status);
          return;
        }
      } catch {
        /* Keep asking; the network may come back. */
      }
      if (Date.now() - started > pollFor) setGaveUp(true);
      else timer = setTimeout(check, pollMs);
    }
    timer = setTimeout(check, pollMs);
    return () => clearTimeout(timer);
  }, [state, reference, router]);

  if (state === "FAILED")
    return (
      <div className="empty-state">
        <Icon name="alert" size={28} />
        <h1>Payment didn’t go through</h1>
        <p>
          Nothing was charged and your places were released. Your cart is
          unchanged, so you can try again.
        </p>
        <div className="actions">
          <Link className="button" href="/checkout">
            Back to checkout
          </Link>
          <Link className="button secondary" href="/cart">
            View cart
          </Link>
        </div>
      </div>
    );
  if (state === "REQUIRES_REVIEW")
    return (
      <div className="empty-state">
        <Icon name="info" size={28} />
        <h1>We’re checking your payment</h1>
        <p>
          Your payment arrived, but we need to check it before confirming your
          bookings, for example because places sold out while you paid. Our team
          will contact you. If we can’t confirm, you’ll get a full refund.
          Reference: <code>{reference}</code>.
        </p>
        <Link className="button secondary" href="/bookings">
          My bookings
        </Link>
      </div>
    );
  return (
    <div className="empty-state" role="status">
      <div className="spinner" aria-hidden="true" />
      <h1>Confirming your payment…</h1>
      <p>
        {gaveUp
          ? "This is taking longer than usual. You don’t need to pay again: your bookings appear in My bookings as soon as the payment is confirmed."
          : "This usually takes a few seconds. You don’t need to pay again."}
      </p>
      <Link className="button secondary" href="/bookings">
        My bookings
      </Link>
    </div>
  );
}

// The local stand-in for the provider's payment page.
export function SimulatedPay({
  reference,
  amountMinor,
  email,
}: {
  reference: string;
  amountMinor: number;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function finish(outcome: "SUCCESS" | "FAILED") {
    setBusy(true);
    setError("");
    const response = await fetch("/api/v1/payments/simulated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, outcome }),
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setError("That didn’t work. This payment may already be finished.");
      return;
    }
    router.replace(
      `/checkout/return?reference=${encodeURIComponent(reference)}`,
    );
  }
  return (
    <div className="card simulated-pay">
      <p className="eyebrow">Simulated payment · local development</p>
      <h1>Pay {formatMoney(amountMinor)}</h1>
      <p className="muted">
        Stands in for Paystack’s payment page while no test keys are set. No
        card is asked for and no money moves. Receipt to {email}.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => finish("SUCCESS")}>
          <Icon name="check" size={16} />
          Pay successfully
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => finish("FAILED")}
        >
          Decline the payment
        </button>
      </div>
    </div>
  );
}

// Lines that became bookings leave the browser cart too. The server cart
// already dropped them; this covers a cart with unsaved local changes.
export function ClearPaidLines({ ids }: { ids: string[] }) {
  const { removeMany } = useCart();
  const key = ids.join(",");
  useEffect(() => {
    removeMany(key.split(","));
    // removeMany is recreated each render; key is the ids' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
