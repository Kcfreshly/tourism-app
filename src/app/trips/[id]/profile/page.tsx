import { requireSignedIn } from "@/server/page-auth";
import Intake from "@/components/intake";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn(`/trips/${encodeURIComponent(id)}/profile`);
  return <Intake id={id} />;
}
