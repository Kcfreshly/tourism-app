import {
  ApiError,
  checkOrigin,
  failure,
  identity,
  success,
} from "@/server/identity";
import { limit } from "@/server/limits";
import { loadBucket, saveBucket } from "@/server/bucket";
import { bucketWriteSchema } from "@/domain/bucket";

// The signed-in account's saved bucket. Guests keep theirs in the browser.
export async function GET() {
  try {
    const actor = await identity();
    return success(await loadBucket(actor.id));
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(request: Request) {
  try {
    await checkOrigin();
    const actor = await identity();
    await limit(`bucket-write:${actor.id}`, 60);
    const input = bucketWriteSchema.safeParse(await request.json());
    if (!input.success)
      throw new ApiError(
        422,
        "INVALID_BUCKET",
        "Send up to 30 unique offer ids and the bucket version.",
      );
    return success(
      await saveBucket(
        actor.id,
        input.data.offerIds,
        input.data.expectedVersion,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
