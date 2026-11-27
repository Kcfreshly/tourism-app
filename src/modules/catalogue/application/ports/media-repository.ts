import type { ImageType } from "../../domain/images";

export type StoredImage = { id: string; contentType: string; data: Uint8Array };

export interface MediaRepository {
  // Stores an image, or returns the existing id for identical bytes.
  save(image: {
    id: string;
    contentType: ImageType;
    data: Uint8Array;
    sha256: string;
    uploadedBy: string;
  }): Promise<{ id: string }>;
  find(id: string): Promise<StoredImage | null>;
}
