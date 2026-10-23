import PhotoCredit from "@/components/photo-credit";
import Link from "next/link";
import { BucketButton, PlanTrip } from "@/components/bucket";
import { notFound } from "next/navigation";
import { listCatalogue } from "@/server/catalogue";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = (await listCatalogue()).find((e) => e.seedKey === slug);
  if (!e) notFound();
  return (
    <section>
      <Link href="/explore">← All experiences</Link>
      <div className="detail">
        <img src={e.imagePath} alt={e.inspirationPhoto?.title ?? e.name} />
        <div>
          <p className="eyebrow">
            {e.categoryId} · {e.zoneId} · {e.kind}
          </p>
          <h1>{e.name}</h1>
          <p className="lede">{e.description}</p>
          {e.inspirationPhoto && <PhotoCredit photo={e.inspirationPhoto} />}
          <p>
            {e.durationMinMinutes}–{e.durationMaxMinutes} minutes · adults 18+ ·
            party {e.offer.minParty}–{e.offer.maxParty}
          </p>
          <p>
            Wheelchair access: <strong>Not confirmed</strong>. Walking
            intensity: {e.mobility.intensity.toLowerCase()}.
          </p>
          <h3>Included</h3>
          <ul>
            {e.inclusions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <h3>Separate from this experience</h3>
          <ul>
            {e.exclusions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p>
            Demo opening window: {e.availabilityLocal.opensAt}–
            {e.availabilityLocal.closesAt} Africa/Lagos. Dated bookable slots
            have not been created.
          </p>
          <p>
            Demo policy: fully refundable until 48 hours before service. No real
            booking or refund is available.
          </p>
          <p>
            Meeting point, supplier agreement and verification:{" "}
            <strong>not supplied</strong>.
          </p>
          <p className="price">
            ₦{(e.offer.rateMinor / 100).toLocaleString("en-NG")} /{" "}
            {e.offer.priceBasis === "PER_ADULT" ? "adult" : "group"}
          </p>
          <BucketButton id={e.offer.id} />
          <PlanTrip />
        </div>
      </div>
    </section>
  );
}
