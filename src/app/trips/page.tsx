import MyTrips from "@/components/my-trips";
import { requireSignedIn } from "@/server/page-auth";
export default async function Trips({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireSignedIn("/trips");
  return <MyTrips saved={(await searchParams).saved} />;
}
