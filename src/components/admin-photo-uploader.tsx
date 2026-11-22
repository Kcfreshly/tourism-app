"use client";
import { useState } from "react";
import {
  imageUrl,
  makePrimary,
  maxImageBytes,
  maxListingImages,
  type ListingImage,
} from "@/modules/catalogue/domain/images";

// Uploads listing photos one at a time and arranges them. The first photo is
// the primary one: travellers see it on cards and as the main image.
export default function PhotoUploader({
  images,
  onChange,
}: {
  images: ListingImage[];
  onChange: (images: ListingImage[]) => void;
}) {
  const [uploading, setUploading] = useState(0),
    [errors, setErrors] = useState<string[]>([]);
  const room = maxListingImages - images.length;

  async function upload(files: File[]) {
    const problems: string[] = [];
    const added: ListingImage[] = [];
    const queue = files.slice(0, room);
    if (files.length > room)
      problems.push(`Only ${maxListingImages} photos per listing.`);
    setUploading(queue.length);
    for (const file of queue) {
      try {
        if (file.size > maxImageBytes) throw Error("larger than 5 MB");
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/v1/admin/media", {
          method: "POST",
          body: form,
        });
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (![...images, ...added].some((i) => i.id === body.data.id))
          added.push({ id: body.data.id, alt: "" });
      } catch (e) {
        problems.push(
          `${file.name}: ${e instanceof Error ? e.message : "upload failed"}`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...images, ...added]);
    setErrors(problems);
  }

  const move = (from: number, to: number) => {
    const next = [...images];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <fieldset className="admin-photos">
      <legend>Photos</legend>
      <p className="form-hint">
        JPEG, PNG or WebP, up to 5 MB each and {maxListingImages} per listing.
        The primary photo shows on cards; the detail page shows them all in a
        grid and the quick view lets travellers step through them.
      </p>
      {images.length > 0 && (
        <ol className="admin-photo-grid">
          {images.map((image, i) => (
            <li key={image.id} className="admin-photo-item">
              <div className="admin-photo-frame">
                <img
                  src={imageUrl(image.id)}
                  alt={image.alt || `Photo ${i + 1}`}
                />
                {i === 0 && (
                  <span className="admin-photo-primary">Primary</span>
                )}
              </div>
              <label>
                Describe the photo
                <input
                  maxLength={200}
                  placeholder="What it shows, for screen readers"
                  value={image.alt}
                  onChange={(e) =>
                    onChange(
                      images.map((x, j) =>
                        j === i ? { ...x, alt: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <div className="admin-row-actions">
                {i > 0 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onChange(makePrimary(images, i))}
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Move photo ${i + 1} earlier`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Move photo ${i + 1} later`}
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <label className="admin-photo-add">
        {uploading
          ? `Uploading ${uploading}…`
          : images.length
            ? "Add more photos"
            : "Add photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!!uploading || room <= 0}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) upload(files);
          }}
        />
      </label>
      {errors.length > 0 && (
        <ul className="field-error" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
