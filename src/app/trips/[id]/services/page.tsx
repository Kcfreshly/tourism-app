import { pages } from "@/bootstrap/container";
import Planner from "@/components/planner";
export default async function ServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pages.requireSignedIn(`/trips/${encodeURIComponent(id)}/services`);
  return <Planner id={id} servicesOnly />;
}
