import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { MergeGuestDrafts } from "../../../application/use-cases/merge-guest-drafts";
import type { RequestGuards } from "../request-guards";
import { forgetGuest, guestToken } from "../guest-cookie";

export function createMergeGuestDraftsController(
  guards: RequestGuards,
  mergeGuestDrafts: MergeGuestDrafts,
) {
  return controller(async () => {
    await guards.checkOrigin();
    const actor = await guards.currentActor();
    if (!actor)
      throw new AppError(
        "UNAUTHENTICATED",
        "SIGN_IN_REQUIRED",
        "Sign in before linking drafts.",
      );
    const merged = await mergeGuestDrafts.execute({
      accountId: actor.id,
      guestToken: await guestToken(),
    });
    if (merged === null) return success({ merged: 0 });
    await forgetGuest();
    return success({ merged });
  });
}
