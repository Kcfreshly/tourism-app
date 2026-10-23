import Link from "next/link";
import { photoForCategory } from "@/domain/photos";
import categories from "../../tourism-v1-handoff/data/categories.json";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">A LITTLE DISCOVERY. A LOT OF YOU.</p>
          <h1>
            Your Lagos stay,
            <br />
            <em>thoughtfully arranged.</em>
          </h1>
          <p className="lede">
            Build a trip around what you love. We’ll coordinate the experiences,
            transport and local support.
          </p>
          <div className="entry-paths">
            <div>
              <Link className="button" href="/plan/new?mode=chat">
                Plan with Kemi
              </Link>
              <p>
                Tell Kemi about your trip. Get a personalised itinerary you can
                customise.
              </p>
            </div>
            <div>
              <Link className="button secondary" href="/explore">
                Explore Experiences
              </Link>
              <p>
                Save activities to your bucket, then organise them into your
                trip.
              </p>
            </div>
          </div>
          <p className="muted">
            Saving an activity does not book it or assign a time. You can
            customise your plan whichever way you start.
          </p>
        </div>
        <div className="hero-art photo-hero">
          <img
            src="/assets/photos/lekki-canopy.webp"
            alt="Canopy walkway at Lekki Conservation Centre, Lagos, Nigeria"
          />
          <div className="art-note">
            LAGOS LIFE
            <br />
            <strong>Make room for the everyday extraordinary.</strong>
          </div>
          <span className="art-caption">
            Lekki Conservation Centre / Photo: Liesel81 / CC BY-SA 4.0
          </span>
        </div>
      </section>
      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">FOLLOW YOUR CURIOSITY</p>
            <h2>Find your kind of Lagos</h2>
          </div>
          <Link href="/explore">Explore the demo catalogue ↗</Link>
        </div>
        <div className="categories">
          {categories.map((c) => (
            <Link
              className="category photo-category"
              href={`/explore?category=${c.id}`}
              key={c.id}
            >
              <img
                src={photoForCategory(c.id).src}
                alt={photoForCategory(c.id).title}
                loading="lazy"
              />
              <h3>{c.label}</h3>
              <span>Explore →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="steps">
        <div>
          <span>01 / YOUR STAY</span>
          <h3>Tell us what matters.</h3>
          <p>Your dates, interests and one accommodation base.</p>
        </div>
        <div>
          <span>02 / YOUR RHYTHM</span>
          <h3>Make the plan yours.</h3>
          <p>Local experiences, with room for rest and family time.</p>
        </div>
        <div>
          <span>03 / YOUR NEXT STEP</span>
          <h3>Explore, then shape your days.</h3>
          <p>
            Save favourites to your bucket, then open My Bucket or All
            Experiences in your planner to build your itinerary.
          </p>
        </div>
      </section>
    </>
  );
}
