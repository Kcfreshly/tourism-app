import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pages } from "@/bootstrap/container";
import { SimulatedPay } from "@/components/payment-status";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulated payment" };

// The local payment page used when PAYMENT_PROVIDER=simulated.
export default async function SimulatedPayment({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const reference = ((await searchParams).reference ?? "").slice(0, 100);
  await pages.requireSignedIn(
    `/checkout/simulated?reference=${encodeURIComponent(reference)}`,
  );
  const actor = await pages.currentActor();
  const payment = actor && (await pages.simulatedPayment(actor.id, reference));
  if (!payment) notFound();
  if (!payment.open)
    redirect(`/checkout/return?reference=${encodeURIComponent(reference)}`);
  return (
    <section className="page checkout-page">
      <SimulatedPay
        reference={payment.reference}
        amountMinor={payment.amountMinor}
        email={payment.email}
      />
    </section>
  );
}
