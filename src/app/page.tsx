import Link from "next/link";
import Icon from "@/components/icons";
import { photoById, photoForCategory } from "@/domain/photos";
import categories from "../../tourism-v1-handoff/data/categories.json";

const hero = photoById("elegushi-evening");
const exampleDay = [
  { time: "09:00", title: "Morning nature walk", kind: "Flexible start" },
  { time: "12:30", title: "Lunch with family", kind: "Personal time" },
  { time: "15:00", title: "Contemporary art visit", kind: "Flexible start" },
  { time: "19:00", title: "Hosted suya evening", kind: "Set session" },
];

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Lagos trip planning</p>
          <h1>
            Lagos, <span>your way.</span>
          </h1>
          <p className="lede">
            Build a stay around what you love. We bring experiences, transport
            and local hosts together into one clear plan, priced as you go.
          </p>
          <div className="entry-paths">
            <Link
              className="entry-path entry-path--kemi"
              href="/plan/new?mode=chat"
            >
              <span className="kemi-avatar" aria-hidden="true">
                K
              </span>
              <span className="entry-path-text">
                <strong>Plan with Kemi</strong>
                <span>
                  Tell Kemi about your trip. Get a personalised itinerary you
                  can customise.
                </span>
              </span>
              <Icon name="arrowRight" size={22} />
            </Link>
            <Link className="entry-path" href="/explore">
              <span className="entry-icon" aria-hidden="true">
                <Icon name="compass" size={24} />
              </span>
              <span className="entry-path-text">
                <strong>Explore experiences</strong>
                <span>
                  Save activities to your bucket, then organise them into your
                  trip.
                </span>
              </span>
              <Icon name="arrowRight" size={22} />
            </Link>
          </div>
        </div>
        <figure className="home-hero-media">
          <img
            src={hero.src}
            alt={hero.title}
            width={hero.width}
            height={hero.height}
          />
          <div className="example-day" aria-label="Example day">
            <p className="example-day-head">
              <span>Example day</span>
              <small>Saturday</small>
            </p>
            <ol>
              {exampleDay.map((item) => (
                <li key={item.time} data-kind={item.kind}>
                  <time>{item.time}</time>
                  <span>
                    {item.title}
                    <small>{item.kind}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <figcaption>
            Photo: {hero.author} / {hero.license}
          </figcaption>
        </figure>
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
              Pick a driver, an activity guide or a full-day guide. Your total
              updates with every change.
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
            <h3>Driver only</h3>
            <p>
              A dedicated vehicle for your activity days, with pickup and return
              to your base.
            </p>
          </article>
          <article>
            <Icon name="users" size={26} />
            <h3>Activity guide</h3>
            <p>
              A local guide for the experiences you choose. Hosted experiences
              already include one.
            </p>
          </article>
          <article>
            <Icon name="sun" size={26} />
            <h3>Full-day guide</h3>
            <p>
              A guide with you across the day’s service window, alongside your
              driver.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
