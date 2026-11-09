import MyTrips from "@/components/my-trips";
import { pages } from "@/bootstrap/container";
export default async function Trips({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await pages.requireSignedIn("/trips");
  return <MyTrips saved={(await searchParams).saved} />;
}
