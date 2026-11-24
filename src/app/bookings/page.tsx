import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import { OrderList } from "@/components/bookings";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My bookings" };

export default async function Bookings() {
  await pages.requireSignedIn("/bookings");
  const actor = await pages.currentActor();
  const orders = actor ? await pages.orders(actor.id) : [];
  return (
    <section className="page bookings-page">
      <header className="page-intro">
        <h1>My bookings</h1>
        <p className="lede">
          Everything you’ve paid for. Each activity or trip is its own booking,
          with its own status.
        </p>
      </header>
      <OrderList orders={orders} />
    </section>
  );
}
