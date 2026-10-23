import type { Photo } from "@/domain/photos";

export default function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <p className="photo-credit">
      Destination inspiration: {photo.title}. Photo by {photo.author},{" "}
      <a href={photo.source} target="_blank" rel="noopener noreferrer">
        Wikimedia Commons
      </a>
      {" / "}
      <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">
        {photo.license}
      </a>
      . Resized for this site; may be cropped in the layout. This is not a photo
      of a booked demo offer.
    </p>
  );
}
