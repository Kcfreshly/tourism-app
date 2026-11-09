import type { Metadata } from "next";
import CatalogueBrowser from "@/components/catalogue-browser";
import { pages } from "@/bootstrap/container";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore experiences" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; trip?: string; view?: string }>;
}) {
  const { category, trip, view } = await searchParams;
  const records = await pages.listPublishedExperiences().catch(() => null);
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
