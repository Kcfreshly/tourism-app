import type { Metadata } from "next";
import { requireSignedIn } from "@/server/page-auth";
import Checkout from "@/components/checkout";
export const metadata: Metadata = { title: "Review and checkout" };
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn(`/trips/${encodeURIComponent(id)}/checkout`);
  return <Checkout id={id} />;
}
