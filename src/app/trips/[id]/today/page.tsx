import type { Metadata } from "next";
import Pocket from "@/components/pocket";
export const metadata: Metadata = { title: "Day view" };
export default async function Today({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Pocket id={(await params).id} />;
}
