// Photos staff upload for a listing. The first image is the primary one:
// it is the card and hero image, and the rest follow in order in the gallery.
import { z } from "zod";

export const maxImageBytes = 5 * 1024 * 1024;
export const maxListingImages = 12;
export const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof imageTypes)[number];

export const listingImageSchema = z
  .object({
    id: z.uuid(),
    alt: z.string().trim().max(200),
  })
  .strict();
export type ListingImage = z.infer<typeof listingImageSchema>;

export function imageUrl(id: string) {
  return `/api/v1/media/${id}`;
}

// The type from the file's first bytes, never from its name or the browser's
// claim. SVG and anything else is refused.
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const starts = (sig: number[], at = 0) =>
    sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  return null;
}

// Moves the image at `index` to the front, making it the primary image.
export function makePrimary<T>(images: T[], index: number) {
  if (index <= 0 || index >= images.length) return images;
  return [images[index], ...images.filter((_, i) => i !== index)];
}
