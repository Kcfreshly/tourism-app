import Intake from "@/components/intake";
export default async function NewPlan({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; offer?: string; fresh?: string }>;
}) {
  const { mode, offer, fresh } = await searchParams;
  return <Intake mode={mode} offer={offer} fresh={fresh === "1"} />;
}
