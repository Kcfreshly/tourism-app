import type { Metadata } from "next";
import CatalogueBrowser from "@/components/catalogue-browser";
import { listCatalogue } from "@/server/catalogue";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore experiences" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; trip?: string; view?: string }>;
}) {
  const { category, trip, view } = await searchParams;
  const records = await listCatalogue().catch(() => null);
  if (!records)
    return (
      <section className="page">
        <div className="empty-state">
          <h1>Experiences are unavailable right now</h1>
          <p>
            We couldn’t load the catalogue. Your bucket and trips are safe;
            please try again shortly.
          </p>
        </div>
      </section>
    );
  return (
    <section className="page explore-page">
      <header className="page-intro">
        <p className="eyebrow">Explore Lagos</p>
        <h1>Find experiences worth making time for.</h1>
        <p className="lede">
          Add the ones you like to your bucket. Saving doesn’t book anything or
          give it a time — you’ll arrange your days in the planner.
        </p>
      </header>
      <CatalogueBrowser
        key={`${view}-${category}`}
        records={records}
        initialCategory={category}
        initialView={view}
        tripId={trip}
      />
    </section>
  );
}
