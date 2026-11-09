import Intake from "@/components/intake";
import { pages } from "@/bootstrap/container";
export default async function NewPlan({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; offer?: string; fresh?: string }>;
}) {
  const { mode, offer, fresh } = await searchParams;
  const query = new URLSearchParams(
    Object.entries({ mode, offer, fresh }).filter(
      (entry): entry is [string, string] => !!entry[1],
    ),
  ).toString();
  await pages.requireSignedIn(`/plan/new${query ? `?${query}` : ""}`);
  return <Intake mode={mode} offer={offer} fresh={fresh === "1"} />;
}
