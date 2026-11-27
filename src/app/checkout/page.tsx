import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import CheckoutReview from "@/components/checkout-review";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review and pay" };
// Browsing, saving and the cart work as a guest. Checkout asks for sign-in
// unless every item is an event whose partner allows guest checkout; the
// form decides, since the guest cart lives in the browser.
export default async function Checkout() {
  const actor = await pages.currentActor();
  return (
    <CheckoutReview
      signedIn={!!actor}
      paymentsEnabled={pages.paymentsEnabled()}
    />
  );
}
