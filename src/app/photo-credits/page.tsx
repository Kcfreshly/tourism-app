import { nigeriaPhotos } from "@/domain/photos";

export default function PhotoCredits() {
  return (
    <section>
      <p className="eyebrow">PHOTOGRAPHY</p>
      <h1>Views of Nigeria, with credit.</h1>
      <p className="lede">
        Real Nigerian places and cuisine. These images provide destination
        inspiration; the demo catalogue does not represent bookings at these
        venues.
      </p>
      <div className="experience-grid">
        {nigeriaPhotos.map((photo) => (
          <article className="card card-body" key={photo.id}>
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              style={{
                width: "100%",
                height: 200,
                objectFit: "cover",
                borderRadius: 12,
              }}
              alt={photo.title}
            />
            <h2>{photo.title}</h2>
            <p>Photograph by {photo.author}.</p>
            <p>
              <a href={photo.source}>Original source</a> /{" "}
              <a href={photo.licenseUrl}>{photo.license}</a>
            </p>
            <p className="muted">{photo.modifications}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
