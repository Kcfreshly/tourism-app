import { pages } from "@/bootstrap/container";
import Planner from "@/components/planner";
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pages.requireSignedIn(`/trips/${encodeURIComponent(id)}/plan`);
  return <Planner id={id} />;
}
