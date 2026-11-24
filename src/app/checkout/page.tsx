import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import CheckoutReview from "@/components/checkout-review";
export const metadata: Metadata = { title: "Review and pay" };
// Browsing, saving and the cart work as a guest; sign-in is asked here.
export default async function Checkout() {
  await pages.requireSignedIn("/checkout");
  return <CheckoutReview paymentsEnabled={pages.paymentsEnabled()} />;
}
