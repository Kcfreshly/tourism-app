import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { GetBucket } from "../../../application/use-cases/get-bucket";

// The signed-in account's saved bucket. Guests keep theirs in the browser.
export function createGetBucketController(
  guards: RequestGuards,
  getBucket: GetBucket,
) {
  return controller(async () => {
    const actor = await guards.requireActor();
    return success(await getBucket.execute(actor.id));
  });
}
