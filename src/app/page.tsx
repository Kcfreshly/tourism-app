import Link from "next/link";
import Icon from "@/components/icons";
import { photoById, photoForCategory } from "@/domain/photos";
import categories from "../../tourism-v1-handoff/data/categories.json";

const hero = photoById("fanti-carnival");
// const heroTags = [
//   { label: "Festivals", href: "/explore?category=events" },
//   { label: "Beaches", href: "/explore?category=waterfront" },
//   { label: "Afrobeats nights", href: "/explore?category=nightlife" },
//   { label: "Food", href: "/explore?category=food" },
//   { label: "Art & history", href: "/explore?category=culture" },
// ];

export default function Home() {
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
            Lagos, Nigeria · West Africa
          </p>
          <h1>
            Lagos, <span>your way.</span>
          </h1>
          <p className="home-hero-lede">
            Carnivals and masquerades, Atlantic beaches, Afrobeats nights and
            jollof worth flying for. Tell us what you love — we’ll plan the
            days, the drivers and the local hosts.
          </p>
          <div className="home-hero-actions">
            <Link
              className="hero-cta hero-cta--primary"
              href="/plan/new?mode=chat"
            >
              <span className="kemi-avatar" aria-hidden="true">
                K
              </span>
              Plan with Kemi
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link className="hero-cta" href="/explore">
              Explore experiences
            </Link>
          </div>
          {/* <nav className="home-hero-tags" aria-label="Popular in Lagos">
            {heroTags.map((tag) => (
              <Link key={tag.label} href={tag.href}>
                {tag.label}
              </Link>
            ))}
          </nav> */}
        </div>
        <p className="home-hero-credit">
          {hero.title} · Photo: {hero.author} / {hero.license}
        </p>
      </section>

      <section className="page-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Follow your curiosity</p>
            <h2>Find your kind of Lagos</h2>
          </div>
          <Link className="text-link" href="/explore">
            All experiences <Icon name="arrowRight" size={16} />
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

      <section
        className="promise-strip"
        aria-label="How saving and booking work"
      >
        <div>
          <Icon name="bookmark" size={22} />
          <p>
            <strong>Saving isn’t booking.</strong> Your bucket is a shortlist of
            ideas.
          </p>
        </div>
        <div>
          <Icon name="clock" size={22} />
          <p>
            <strong>No times until you choose.</strong> Arrange each day in the
            planner.
          </p>
        </div>
        <div>
          <Icon name="edit" size={22} />
          <p>
            <strong>Yours to change.</strong> Customise the plan however you
            started.
          </p>
        </div>
      </section>

      <section className="page-section how-it-works">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>From idea to itinerary in three steps</h2>
          </div>
        </div>
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>Tell us about your stay</h3>
            <p>
              Dates, who’s coming, where you’re staying and what you love — by
              chatting with Kemi or filling in a short form.
            </p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>Shape your days</h3>
            <p>
              Drag experiences into each day. Opening hours, set sessions and
              travel time are checked for you, so nothing overlaps.
            </p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>Choose your support</h3>
            <p>
              A driver comes with every activity day. Add guides in any mix, and
              your total updates with every change.
            </p>
          </li>
        </ol>
      </section>

      <section className="page-section support-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">What we arrange</p>
            <h2>Getting around, taken care of</h2>
          </div>
        </div>
        <div className="support-grid">
          <article>
            <Icon name="car" size={26} />
            <h3>Your own driver</h3>
            <p>
              A dedicated vehicle on every activity day, with pickup and return
              to your base.
            </p>
          </article>
          <article>
            <Icon name="users" size={26} />
            <h3>Guides for chosen activities</h3>
            <p>
              Add a local guide to the experiences you pick. Hosted experiences
              already include one.
            </p>
          </article>
          <article>
            <Icon name="sun" size={26} />
            <h3>Full-day guide</h3>
            <p>
              A guide with you for the whole day, on the days you choose. Mix it
              with activity guides on other days.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
