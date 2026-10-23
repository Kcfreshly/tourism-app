import type { Metadata } from "next";
import { nigeriaPhotos } from "@/domain/photos";
export const metadata: Metadata = { title: "Photo credits" };

export default function PhotoCredits() {
  return (
    <section className="page">
      <div className="page-intro">
        <p className="eyebrow">Photography</p>
        <h1>Views of Lagos, with credit</h1>
        <p className="lede">
          Real Nigerian places and food, used as destination inspiration. The
          sample experiences in this preview are not bookings at these venues.
        </p>
      </div>
      <div className="credit-grid">
        {nigeriaPhotos.map((photo) => (
          <article className="card credit-card" key={photo.id}>
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={photo.title}
              loading="lazy"
            />
            <div className="card-body">
              <h2>{photo.title}</h2>
              <p>Photograph by {photo.author}.</p>
              <p>
                <a href={photo.source}>Original source</a> ·{" "}
                <a href={photo.licenseUrl}>{photo.license}</a>
              </p>
              <p className="muted">{photo.modifications}</p>
            </div>
          </article>
        ))}
        <article className="card credit-card">
          <div className="card-body">
            <h2>Typeface</h2>
            <p>
              Bricolage Grotesque by The Bricolage Grotesque Project Authors,
              used under the{" "}
              <a href="/fonts/OFL.txt">SIL Open Font License 1.1</a>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
