import { requireSignedIn } from "@/server/page-auth";
import Planner from "@/components/planner";
export default async function ServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn(`/trips/${encodeURIComponent(id)}/services`);
  return <Planner id={id} servicesOnly />;
}
