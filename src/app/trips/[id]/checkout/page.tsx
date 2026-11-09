import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import Checkout from "@/components/checkout";
export const metadata: Metadata = { title: "Review and checkout" };
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pages.requireSignedIn(`/trips/${encodeURIComponent(id)}/checkout`);
  return <Checkout id={id} />;
}
