import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pages } from "@/bootstrap/container";
import { PaymentStatus } from "@/components/payment-status";
import { AppError } from "@/shared/application/app-error";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment" };

// Where the payment page sends the traveller back. Verifies the payment
// itself rather than waiting for the webhook; both lead to the same order.
// A guest buyer is recognised by their browser's guest key.
export default async function PaymentReturn({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const query = await searchParams;
  const reference = (query.reference ?? query.trxref ?? "").slice(0, 100);
  const here = `/checkout/return?reference=${encodeURIComponent(reference)}`;
  const viewer = await pages.viewer();
  if (!viewer.userId && !viewer.guestKeyHash) await pages.requireSignedIn(here);
  if (!reference) notFound();
  let state;
  try {
    state = await pages.confirmOwnPayment(viewer, reference);
  } catch (e) {
    if (e instanceof AppError && e.kind === "NOT_FOUND") {
      // Perhaps an account payment, opened while signed out.
      if (!viewer.userId) await pages.requireSignedIn(here);
      notFound();
    }
    throw e;
  }
  if (state.status === "PAID")
    redirect(`/bookings/${state.orderReference}?paid=1`);
  return (
    <section className="page checkout-page">
      <PaymentStatus reference={reference} initial={state.status} />
    </section>
  );
}
