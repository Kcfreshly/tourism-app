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
  searchParams: Promise<{ paid?: string; k?: string }>;
}) {
  const { reference } = await params;
  const { paid: paidParam, k: linkKey } = await searchParams;
  const here = `/bookings/${encodeURIComponent(reference)}`;
  // A guest buyer's browser holds the key to their order; the link in the
  // confirmation email opens it anywhere.
  const viewer = await pages.viewer();
  if (!linkKey && !viewer.userId && !viewer.guestKeyHash)
    await pages.requireSignedIn(here);
  let order;
  try {
    order = linkKey
      ? await pages.orderFromLink(reference, linkKey)
      : await pages.order(viewer, reference);
  } catch (e) {
    if (e instanceof AppError && e.kind === "NOT_FOUND") {
      if (!viewer.userId) await pages.requireSignedIn(here);
      notFound();
    }
    throw e;
  }
  const guest = !viewer.userId;
  const paid = paidParam === "1";
  const emailed = pages.emailOn();
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
              bookings
              {emailed
                ? ` and in the email we’ve sent to ${order.contact.email}`
                : ""}
              .
            </p>
          </div>
        </div>
      )}
      {paid && !waiting && (
        <p className="notice" role="status">
          <Icon name="check" size={16} /> Thank you. Keep the reference{" "}
          <strong>{order.reference}</strong>
          {guest
            ? `. Your tickets are saved in this browser under My bookings${emailed ? ` and on their way to ${order.contact.email}` : ""}. Show this page, the email or the reference at the door.`
            : "; it’s also in My bookings."}
        </p>
      )}
      <OrderDetail order={order} />
    </section>
  );
}
