import type { Metadata } from "next";
import Link from "next/link";
import CatalogueBrowser from "@/components/catalogue-browser";
import { pages } from "@/bootstrap/container";
import { destinationById } from "@/modules/catalogue/domain/destinations";
import { lagosToday } from "@/modules/catalogue/domain/events";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Things to do" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    kind?: string;
    access?: string;
    trip?: string;
    view?: string;
    city?: string;
    date?: string;
    from?: string;
    to?: string;
    when?: string;
    price?: string;
    family?: string;
    arrival?: string;
    area?: string;
  }>;
}) {
  const { city, trip, ...filters } = await searchParams;
  if (city && !destinationById(city))
    return (
      <section className="page">
        <div className="empty-state">
          <h1>Nothing listed there yet</h1>
          <p>
            We only show places where partners have confirmed experiences. Lagos
            is open now.
          </p>
          <Link className="button" href="/explore?city=lagos">
            Things to do in Lagos
          </Link>
        </div>
      </section>
    );
  const records = await pages.listPublishedExperiences().catch(() => null);
  if (!records)
    return (
      <section className="page">
        <div className="empty-state">
          <h1>Experiences are unavailable right now</h1>
          <p>
            We couldn’t load the catalogue. Your Bucket and cart are safe;
            please try again shortly.
          </p>
        </div>
      </section>
    );
  return (
    <section className="page explore-page">
      <CatalogueBrowser
        key={JSON.stringify(filters)}
        records={records}
        initial={filters}
        tripId={trip}
        today={lagosToday()}
      />
    </section>
  );
}
