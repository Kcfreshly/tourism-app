import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pages } from "@/bootstrap/container";
import { PaymentStatus } from "@/components/payment-status";
import { AppError } from "@/shared/application/app-error";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment" };

// Where the payment page sends the traveller back. Verifies the payment
// itself rather than waiting for the webhook; both lead to the same order.
export default async function PaymentReturn({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const query = await searchParams;
  const reference = (query.reference ?? query.trxref ?? "").slice(0, 100);
  await pages.requireSignedIn(
    `/checkout/return?reference=${encodeURIComponent(reference)}`,
  );
  const actor = await pages.currentActor();
  if (!actor || !reference) notFound();
  let state;
  try {
    state = await pages.confirmOwnPayment(actor.id, reference);
  } catch (e) {
    if (e instanceof AppError && e.kind === "NOT_FOUND") notFound();
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
