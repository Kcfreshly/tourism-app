import { requireSignedIn } from "@/server/page-auth";
import type { Metadata } from "next";
import Pocket from "@/components/pocket";
export const metadata: Metadata = { title: "Day view" };
export default async function Today({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn(`/trips/${encodeURIComponent(id)}/today`);
  return <Pocket id={id} />;
}
