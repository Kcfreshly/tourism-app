import { pages } from "@/bootstrap/container";
import Intake from "@/components/intake";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pages.requireSignedIn(`/trips/${encodeURIComponent(id)}/profile`);
  const { airportPickupMinor } = await pages.transportSettings();
  return (
    <Intake
      id={id}
      kemi={pages.kemiEnabled()}
      airportPickupMinor={airportPickupMinor}
    />
  );
}
