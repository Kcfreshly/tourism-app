import Link from "next/link";
import Icon from "@/components/icons";
import DestinationSearch from "@/components/destination-search";
import HomeSections from "@/components/home-sections";
import StartHere from "@/components/start-here";
import { pages } from "@/bootstrap/container";
import { photoById, photoForCategory } from "@/modules/catalogue/domain/photos";
import { lagosToday } from "@/modules/catalogue/domain/events";
import { weekendDates } from "@/modules/catalogue/domain/schedule";
import categories from "../../tourism-v1-handoff/data/categories.json";

export const dynamic = "force-dynamic";
const hero = photoById("fanti-carnival");

export default async function Home() {
  const today = lagosToday();
  // Sections hide when the catalogue can't be read; the search still works.
  const [records, packages] = await Promise.all([
    pages.listPublishedExperiences().catch(() => []),
    pages.listPublishedPackages().catch(() => []),
  ]);
  return (
    <>
      <section className="home-hero">
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
            Nigeria · Lagos open now
          </p>
          <h1>
            Things to do in <span>Nigeria.</span>
          </h1>
          <p className="home-hero-lede">
            Weekend outings, family days, events and ready-made getaways. Book
            one thing, or plan a whole trip.
          </p>
          <DestinationSearch today={today} />
          <div className="home-hero-paths">
            <span>Or</span>
            <Link href="/plan/new">
              <Icon name="calendar" size={16} />
              Start planning your trip
            </Link>
            <Link href="/packages">
              <Icon name="compass" size={16} />
              Ready-made trips
            </Link>
          </div>
        </div>
        <p className="home-hero-credit">
          {hero.title} · Photo: {hero.author} / {hero.license}
        </p>
      </section>

      <StartHere />

      <HomeSections
        records={records}
        packages={packages}
        weekend={weekendDates(today)}
        today={today}
        city="lagos"
      />

      <section className="page-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Follow your curiosity</p>
            <h2>Browse by category</h2>
          </div>
          <Link className="text-link" href="/explore">
            All things to do <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((c) => {
            const photo = photoForCategory(c.id);
            return (
              <Link
                className="category-tile"
                href={`/explore?category=${c.id}`}
                key={c.id}
              >
                <img src={photo.src} alt="" loading="lazy" />
                <span>{c.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="page-section kemi-card">
        <span className="kemi-avatar" aria-hidden="true">
          <Icon name="compass" size={24} />
        </span>
        <div>
          <h2>Want to plan the whole trip?</h2>
          <p>
            Add your dates and what you love, then arrange each day with drivers
            and guides you can change.
          </p>
        </div>
        <Link className="button" href="/plan/new">
          Start planning your trip
          <Icon name="arrowRight" size={16} />
        </Link>
      </section>

      <section className="promise-strip" aria-label="Save, cart and trip">
        <div>
          <Icon name="bookmark" size={22} />
          <p>
            <strong>Save</strong> keeps an activity in your saved activities. No
            date, nothing held.
          </p>
        </div>
        <div>
          <Icon name="bag" size={22} />
          <p>
            <strong>Add to cart</strong> picks a date and guests to buy. Each
            item is its own booking.
          </p>
        </div>
        <div>
          <Icon name="calendar" size={22} />
          <p>
            <strong>Add to trip</strong> places it in one of your plans. You
            choose the time there.
          </p>
        </div>
      </section>
    </>
  );
}
