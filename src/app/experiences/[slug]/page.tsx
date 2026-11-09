import type { Metadata } from "next";
import PhotoCredit from "@/components/photo-credit";
import Link from "next/link";
import { BucketButton, PlanTrip } from "@/components/bucket";
import Icon from "@/components/icons";
import { notFound } from "next/navigation";
import { pages } from "@/bootstrap/container";
import {
  categoryShortLabels,
  displayName,
  formatDuration,
  formatMoney,
  kindLabels,
  priceBasisLabel,
  storyFor,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
export const dynamic = "force-dynamic";
const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
async function find(slug: string) {
  return (await pages.listPublishedExperiences()).find(
    (e) => e.seedKey === slug,
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const e = await find((await params).slug).catch(() => undefined);
  return { title: e ? displayName(e.name) : "Experience" };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = await find(slug);
  if (!e) notFound();
  const story = storyFor(e.seedKey, e.categoryId);
  return (
    <section className="detail-page">
      <Link className="text-link back-link" href="/explore">
        <Icon name="arrowLeft" size={16} /> All experiences
      </Link>
      <div className="detail">
        <div className="detail-content">
          <figure className="detail-media">
            <img
              src={e.imagePath}
              alt={e.inspirationPhoto?.title ?? displayName(e.name)}
            />
            {e.inspirationPhoto && (
              <span className="image-label">Destination inspiration</span>
            )}
          </figure>
          <div className="detail-text">
            <p className="eyebrow">
              {categoryShortLabels[e.categoryId]} · {zoneLabel(e.zoneId)} ·{" "}
              {kindLabels[e.kind]}
            </p>
            <h1>{displayName(e.name)}</h1>
            <p className="experience-introduction">{story.summary}</p>
            <dl className="fact-grid">
              <div>
                <dt>
                  <Icon name="clock" size={16} /> Duration
                </dt>
                <dd>
                  {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="calendar" size={16} /> Hours
                </dt>
                <dd>
                  {e.availabilityLocal.days.length === 7
                    ? "Daily"
                    : e.availabilityLocal.days
                        .map((d) => dayNames[d])
                        .join(", ")}
                  , {e.availabilityLocal.opensAt}–{e.availabilityLocal.closesAt}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="users" size={16} /> Group size
                </dt>
                <dd>
                  {e.offer.minParty}–{e.offer.maxParty} adults ({e.offer.minAge}
                  +)
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="pin" size={16} /> Area
                </dt>
                <dd>{zoneLabel(e.zoneId)}, Lagos</dd>
              </div>
            </dl>
            {story.why && (
              <section className="info-section">
                <h2>Why it’s worth it</h2>
                <p>{story.why}</p>
              </section>
            )}
            <section className="info-section">
              <h2>Timing</h2>
              <p>
                {e.schedulingType === "FIXED"
                  ? `Runs at set times: ${e.sessions?.map((s) => s.startTime).join(", ")}. Session times can’t be changed.`
                  : e.kind === "FULL_DAY"
                    ? "Takes up the main part of your day."
                    : `Choose your own start time. The whole visit must finish by ${e.availabilityLocal.closesAt}, Lagos time.`}
              </p>
            </section>
            <div className="inclusion-columns">
              <section className="info-section">
                <h2>Included</h2>
                <ul className="tick-list">
                  {e.inclusions.map((i) => (
                    <li key={i}>
                      <Icon name="check" size={16} />
                      {i.replace(/^Demo a/, "A")}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="info-section">
                <h2>Not included</h2>
                <ul className="cross-list">
                  {e.exclusions.map((i) => (
                    <li key={i}>
                      <Icon name="close" size={16} />
                      {i}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <section className="info-section">
              <h2>Good to know</h2>
              <ul className="plain-list">
                <li>Walking: {e.mobility.intensity.toLowerCase()}.</li>
                <li>Wheelchair access: not confirmed.</li>
                {e.offer.hostIncluded && <li>A local host joins you.</li>}
                <li>
                  Free cancellation up to 48 hours before (sample policy).
                </li>
                <li>Meeting point shared once booked.</li>
              </ul>
            </section>
            {e.inspirationPhoto && <PhotoCredit photo={e.inspirationPhoto} />}
          </div>
        </div>
        <aside className="card detail-aside">
          <p className="card-price">
            <strong>{formatMoney(e.offer.rateMinor)}</strong>
            <span>{priceBasisLabel(e.offer.priceBasis)}</span>
          </p>
          <div className="actions">
            <BucketButton id={e.offer.id} />
            <PlanTrip />
          </div>
          <p className="sample-note">
            <Icon name="info" size={16} />
            Sample listing. Saving adds it to your bucket only — it isn’t booked
            and has no time yet.
          </p>
        </aside>
      </div>
    </section>
  );
}
