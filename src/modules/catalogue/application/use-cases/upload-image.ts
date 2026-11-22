import { createHash, randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import { maxImageBytes, sniffImageType } from "../../domain/images";
import type { MediaRepository } from "../ports/media-repository";

export class UploadImage {
  constructor(private readonly media: MediaRepository) {}

  async execute(command: { actorId: string; data: Uint8Array }) {
    if (!command.data.byteLength)
      throw new AppError("INVALID", "EMPTY_FILE", "The file is empty.");
    if (command.data.byteLength > maxImageBytes)
      throw new AppError(
        "INVALID",
        "FILE_TOO_LARGE",
        "Photos can be up to 5 MB. Resize it and try again.",
      );
    const contentType = sniffImageType(command.data);
    if (!contentType)
      throw new AppError(
        "INVALID",
        "UNSUPPORTED_IMAGE",
        "Upload a JPEG, PNG or WebP photo.",
      );
    const sha256 = createHash("sha256").update(command.data).digest("hex");
    return this.media.save({
      id: randomUUID(),
      contentType,
      data: command.data,
      sha256,
      uploadedBy: command.actorId,
    });
  }
}
