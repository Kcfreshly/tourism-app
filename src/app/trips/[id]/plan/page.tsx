import Planner from "@/components/planner";
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Planner id={(await params).id} />;
}
