import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/icons";
import HomeSections from "@/components/home-sections";
import { pages } from "@/bootstrap/container";
import { destinationById } from "@/modules/catalogue/domain/destinations";
import { lagosToday } from "@/modules/catalogue/domain/events";
import { photoById } from "@/modules/catalogue/domain/photos";
import { weekendDates } from "@/modules/catalogue/domain/schedule";

export const dynamic = "force-dynamic";
const hero = photoById("lekki-link-bridge");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const d = destinationById((await params).city);
  return { title: d ? `Things to do in ${d.name}` : "Destination" };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const d = destinationById((await params).city);
  if (!d) notFound();
  const records = await pages.listPublishedExperiences().catch(() => []);
  return (
    <>
      <section className="home-hero destination-hero">
        <img
          className="home-hero-image"
          src={hero.src}
          alt={hero.title}
          width={hero.width}
          height={hero.height}
          fetchPriority="high"
        />
        <div className="home-hero-inner">
          <p className="home-hero-kicker">
            <Icon name="pin" size={16} />
            {d.name}, Nigeria
          </p>
          <h1>
            {d.name}, <span>{d.tagline}</span>
          </h1>
          <p className="home-hero-lede">
            Carnivals and masquerades, Atlantic beaches, Afrobeats nights and
            jollof worth flying for.
          </p>
          <div className="home-hero-actions">
            <Link
              className="hero-cta hero-cta--primary"
              href={`/explore?city=${d.id}`}
            >
              Explore {d.name} experiences
              <Icon name="arrowRight" size={18} />
            </Link>
          </div>
          <nav className="destination-areas" aria-label={`Areas of ${d.name}`}>
            {d.areas.map((a) => (
              <Link key={a.id} href={`/explore?city=${d.id}&area=${a.id}`}>
                {a.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="home-hero-credit">
          {hero.title} · Photo: {hero.author} / {hero.license}
        </p>
      </section>
      <HomeSections
        records={records}
        weekend={weekendDates(lagosToday())}
        city={d.id}
      />
    </>
  );
}
