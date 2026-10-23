import Intake from "@/components/intake";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Intake id={(await params).id} />;
}
