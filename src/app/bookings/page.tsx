import type { Metadata } from "next";
import Link from "next/link";
import { pages } from "@/bootstrap/container";
import { OrderList } from "@/components/bookings";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My bookings" };

// Account orders, plus tickets bought as a guest in this browser.
export default async function Bookings() {
  const viewer = await pages.viewer();
  if (!viewer.userId && !viewer.guestKeyHash)
    await pages.requireSignedIn("/bookings");
  const orders = await pages.orders(viewer);
  return (
    <section className="page bookings-page">
      <header className="page-intro">
        <h1>My bookings</h1>
        <p className="lede">
          Everything you’ve paid for. Each activity or trip is its own booking,
          with its own status.
        </p>
      </header>
      {!viewer.userId && (
        <p className="notice">
          These are tickets bought without an account in this browser.{" "}
          <Link href="/account?next=%2Fbookings">Sign in</Link> to see bookings
          made with an account.
        </p>
      )}
      <OrderList orders={orders} />
    </section>
  );
}
