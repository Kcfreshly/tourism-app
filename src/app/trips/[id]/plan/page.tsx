import { requireSignedIn } from "@/server/page-auth";
import Planner from "@/components/planner";
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn(`/trips/${encodeURIComponent(id)}/plan`);
  return <Planner id={id} />;
}
