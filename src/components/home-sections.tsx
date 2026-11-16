import Link from "next/link";
import type { PublishedExperience } from "@/modules/catalogue/domain/experience";
import { listingDetails } from "@/modules/catalogue/domain/listing-details";
import { runsOn, shortDay } from "@/modules/catalogue/domain/schedule";
import { packages } from "@/modules/catalogue/domain/packages";
import { ExperienceCard } from "./catalogue-browser";
import PackageCard from "./package-card";
import Icon from "./icons";
import RailTrack from "./rail";

function Rail({
  eyebrow,
  title,
  href,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="page-section home-rail">
      <div className="section-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <Link className="text-link" href={href}>
          See all <Icon name="arrowRight" size={16} />
        </Link>
      </div>
      <RailTrack label={title}>
        {children}
        <Link className="rail-more" href={href}>
          <span>See all {title.toLowerCase()}</span>
          <Icon name="arrowRight" size={20} />
        </Link>
      </RailTrack>
    </section>
  );
}

// Photo-led sections shared by the homepage and destination pages. Each
// section hides itself when there is nothing to show.
export default function HomeSections({
  records,
  weekend,
  city,
}: {
  records: PublishedExperience[];
  weekend: string[];
  city: string;
}) {
  const thisWeekend = records
    .filter((e) => weekend.some((d) => runsOn(e, d)))
    .slice(0, 8);
  const family = records
    .filter((e) => listingDetails(e).familySuitable)
    .slice(0, 8);
  return (
    <>
      {thisWeekend.length > 0 && (
        <Rail
          eyebrow={weekend.map(shortDay).join(" – ")}
          title="Happening this weekend"
          href={`/explore?city=${city}&date=weekend`}
        >
          {thisWeekend.map((e) => (
            <ExperienceCard
              key={e.id}
              experience={e}
              date={weekend.find((d) => runsOn(e, d))}
            />
          ))}
        </Rail>
      )}
      {family.length > 0 && (
        <Rail
          eyebrow="Good for kids"
          title="Family outings"
          href={`/explore?city=${city}&family=1`}
        >
          {family.map((e) => (
            <ExperienceCard key={e.id} experience={e} />
          ))}
        </Rail>
      )}
      {packages.length > 0 && (
        <Rail
          eyebrow="Ready-made trips"
          title="Multi-day getaways"
          href="/packages"
        >
          {packages.map((p) => (
            <PackageCard key={p.slug} p={p} />
          ))}
        </Rail>
      )}
    </>
  );
}
