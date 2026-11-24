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
  const here = `/bookings/${encodeURIComponent(reference)}`;
  // A guest buyer's browser holds the key to their order.
  const viewer = await pages.viewer();
  if (!viewer.userId && !viewer.guestKeyHash) await pages.requireSignedIn(here);
  let order;
  try {
    order = await pages.order(viewer, reference);
  } catch (e) {
    if (e instanceof AppError && e.kind === "NOT_FOUND") {
      if (!viewer.userId) await pages.requireSignedIn(here);
      notFound();
    }
    throw e;
  }
  const guest = !viewer.userId;
  const paid = (await searchParams).paid === "1";
  const waiting =
    order.bookings.filter((b) => b.status === "AWAITING_PARTNER").length +
    order.services.filter((sv) => sv.status === "REQUESTED").length;
  const confirmed =
    order.bookings.filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status))
      .length +
    order.services.filter((sv) => ["MATCHED", "COMPLETED"].includes(sv.status))
      .length;
  const parts = order.bookings.length + order.services.length;
  // Paying books a place; it is only final once the partner confirms it.
  return (
    <section className="page checkout-page">
      {paid && <ClearPaidLines ids={order.bookings.map((b) => b.cartLineId)} />}
      <header className="page-intro">
        <p className="eyebrow">Order {order.reference}</p>
        <h1>
          {waiting
            ? "Booked, waiting for confirmation"
            : confirmed === parts
              ? paid
                ? "You’re booked"
                : "Your booking"
              : "Your booking"}
        </h1>
        <p className="lede">
          {waiting
            ? `Payment received. ${confirmed} of ${parts} ${parts === 1 ? "part" : "parts"} confirmed so far; ${waiting} still waiting for the partner to confirm or for us to match you.`
            : confirmed === parts
              ? `${parts === 1 ? "It’s" : `All ${parts} parts are`} confirmed.`
              : `${confirmed} of ${parts} ${parts === 1 ? "part" : "parts"} confirmed. See each one below.`}
        </p>
      </header>
      {paid && waiting > 0 && (
        <div className="notice notice-row" role="status">
          <Icon name="clock" size={18} />
          <div>
            <strong>Your booking isn’t final until it’s confirmed</strong>
            <p>
              We’ve sent it to the partner. Each part below shows when they’ll
              confirm by. If they can’t, that part is refunded in full. Keep
              the reference <strong>{order.reference}</strong>; it’s also in My
              bookings.
            </p>
          </div>
        </div>
      )}
      {paid && !waiting && (
        <p className="notice" role="status">
          <Icon name="check" size={16} /> Thank you. Keep the reference{" "}
          <strong>{order.reference}</strong>
          {guest
            ? `. Your tickets are saved in this browser under My bookings. Show this page or the reference at the door; tickets go to ${order.contact.email} once email is switched on.`
            : "; it’s also in My bookings."}
        </p>
      )}
      <OrderDetail order={order} />
    </section>
  );
}
