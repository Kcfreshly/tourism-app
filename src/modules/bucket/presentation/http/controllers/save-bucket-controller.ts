import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { bucketWriteSchema } from "../../../domain/bucket";
import type { SaveBucket } from "../../../application/use-cases/save-bucket";

export function createSaveBucketController(
  guards: RequestGuards,
  saveBucket: SaveBucket,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireActor();
    await guards.throttle(`bucket-write:${actor.id}`, 60);
    const input = bucketWriteSchema.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_BUCKET",
        "Send up to 30 unique offer ids and the bucket version.",
      );
    return success(
      await saveBucket.execute({ userId: actor.id, ...input.data }),
    );
  });
}
