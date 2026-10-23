import CatalogueBrowser from "@/components/catalogue-browser";
import { listCatalogue } from "@/server/catalogue";
export const dynamic = "force-dynamic";
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; trip?: string }>;
}) {
  const { category, trip } = await searchParams;
  const records = await listCatalogue().catch(() => null);
  if (!records)
    return (
      <section className="card">
        <h1>Catalogue unavailable</h1>
        <p>
          Run the database migration and demo seed, then reload. No live
          catalogue is connected.
        </p>
      </section>
    );
  return (
    <section>
      <p className="eyebrow">A CITY, MANY WAYS TO EXPERIENCE IT</p>
      <h1>Follow your curiosity.</h1>
      <p className="lede">
        A small, fictional catalogue for trying out your stay.
      </p>
      <CatalogueBrowser
        records={records}
        initialCategory={category}
        tripId={trip}
      />
    </section>
  );
}
