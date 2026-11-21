import type { Metadata } from "next";
import PhotoCredit from "@/components/photo-credit";
import Link from "next/link";
import BookingPanel from "@/components/booking-panel";
import Icon from "@/components/icons";
import { notFound } from "next/navigation";
import { pages } from "@/bootstrap/container";
import {
  categoryShortLabels,
  displayName,
  formatDuration,
  kindLabels,
  storyFor,
  wheelchairLabel,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import {
  ageLabel,
  arrivalLabel,
  cancellationLabel,
  confirmationLabel,
  listingDetails,
} from "@/modules/catalogue/domain/listing-details";
import { lagosToday } from "@/modules/catalogue/domain/events";
import { safeExploreHref } from "@/modules/catalogue/domain/explore-link";
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    date?: string;
    edit?: string;
    book?: string;
    from?: string;
    to?: string;
    back?: string;
  }>;
}) {
  const { slug } = await params;
  const { date, edit, book, from, to, back } = await searchParams;
  const e = await find(slug);
  if (!e) notFound();
  const story = storyFor(e);
  const details = listingDetails(e);
  return (
    <section className="detail-page">
      <Link className="text-link back-link" href={safeExploreHref(back)}>
        <Icon name="arrowLeft" size={16} /> Things to do
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
            <p className="detail-operator">
              Run by <strong>{details.operator}</strong>
            </p>
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
                  <Icon name="users" size={16} /> Who it suits
                </dt>
                <dd>
                  {ageLabel(details)} · up to {e.offer.maxParty} guests
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="pin" size={16} /> Where
                </dt>
                <dd>
                  {details.venue}
                  {details.arrival === "PICKUP_REQUIRED" ? "" : ", Lagos"}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="car" size={16} /> Getting there
                </dt>
                <dd>{arrivalLabel(details)}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="check" size={16} /> Confirmation
                </dt>
                <dd>{confirmationLabel(details)}</dd>
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
                <li>{wheelchairLabel(e.mobility.wheelchairAccess)}</li>
                {e.offer.hostIncluded && <li>A local host joins you.</li>}
                <li>{cancellationLabel(details)} (sample policy).</li>
                <li>
                  Exact meeting point and contact sent with your confirmation.
                </li>
              </ul>
            </section>
            {e.inspirationPhoto && <PhotoCredit photo={e.inspirationPhoto} />}
          </div>
        </div>
        <BookingPanel
          experience={e}
          details={details}
          today={lagosToday()}
          // A force-dynamic server page renders once per request.
          // eslint-disable-next-line react-hooks/purity
          now={Date.now()}
          initialDate={date}
          visit={from && to ? { from, to } : undefined}
          editId={edit}
          startOpen={book === "1"}
        />
      </div>
    </section>
  );
}
