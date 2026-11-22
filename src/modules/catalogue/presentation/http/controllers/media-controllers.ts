import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { imageUrl, maxImageBytes } from "../../../domain/images";
import type { MediaRepository } from "../../../application/ports/media-repository";
import type { UploadImage } from "../../../application/use-cases/upload-image";

// Staff, or verified partners through their own route, upload one photo per
// request as multipart form data, field "file".
export function createUploadImageController(
  guards: RequestGuards,
  upload: UploadImage,
  authorize: () => Promise<{ id: string }> = guards.requireAdmin,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await authorize();
    await guards.throttle(`media-upload:${actor.id}`, 60);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > maxImageBytes + 64 * 1024)
      throw new AppError(
        "INVALID",
        "FILE_TOO_LARGE",
        "Photos can be up to 5 MB. Resize it and try again.",
      );
    const file = (await request.formData().catch(() => null))?.get("file");
    if (!(file instanceof Blob))
      throw new AppError("INVALID", "NO_FILE", "Choose a photo to upload.");
    const saved = await upload.execute({
      actorId: actor.id,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    return success({ id: saved.id, url: imageUrl(saved.id) }, 201);
  });
}

// Public: photos of published listings are shown to everyone. Ids are random
// UUIDs, and the bytes are served with their checked type only.
export function createGetImageHandler(media: MediaRepository) {
  return async (
    _request: Request,
    context: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await context.params;
    const image = z.uuid().safeParse(id).success ? await media.find(id) : null;
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(image.data), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  };
}
