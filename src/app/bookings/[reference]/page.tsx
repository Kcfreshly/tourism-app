import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pages } from "@/bootstrap/container";
import { OrderDetail } from "@/components/bookings";
import { ClearPaidLines } from "@/components/payment-status";
import Icon from "@/components/icons";
import { AppError } from "@/shared/application/app-error";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<Metadata> {
  return { title: `Booking ${(await params).reference}` };
}

export default async function Booking({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { reference } = await params;
  await pages.requireSignedIn(`/bookings/${encodeURIComponent(reference)}`);
  const actor = await pages.currentActor();
  if (!actor) notFound();
  let order;
  try {
    order = await pages.order(actor.id, reference);
  } catch (e) {
    if (e instanceof AppError && e.kind === "NOT_FOUND") notFound();
    throw e;
  }
  const paid = (await searchParams).paid === "1";
  const waiting =
    order.bookings.filter((b) => b.status === "AWAITING_PARTNER").length +
    order.services.filter((sv) => sv.status === "REQUESTED").length;
  const parts = order.bookings.length + order.services.length;
  return (
    <section className="page checkout-page">
      {paid && <ClearPaidLines ids={order.bookings.map((b) => b.cartLineId)} />}
      <header className="page-intro">
        <p className="eyebrow">Order {order.reference}</p>
        <h1>{paid ? "Payment received" : "Your booking"}</h1>
        <p className="lede">
          {parts} {parts === 1 ? "part" : "parts"}
          {waiting
            ? `; ${waiting} still being confirmed or matched.`
            : ", all confirmed."}
        </p>
      </header>
      {paid && (
        <p className="notice" role="status">
          <Icon name="check" size={16} /> Thank you. Keep the reference{" "}
          <strong>{order.reference}</strong>; it’s also in My bookings.
        </p>
      )}
      <OrderDetail order={order} />
    </section>
  );
}
