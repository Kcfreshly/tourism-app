import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { UpdateTripProfile } from "../../../application/use-cases/update-trip-profile";
import {
  tripIdSchema,
  updateTripProfileRequest,
} from "../schemas/trip-requests";

function draftNotFound() {
  return new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
}

export function createUpdateTripProfileController(
  guards: RequestGuards,
  updateProfile: UpdateTripProfile,
) {
  return controller(async (request: Request, { params }: IdParams) => {
    await guards.checkOrigin();
    const { id } = await params;
    if (!tripIdSchema.safeParse(id).success) throw draftNotFound();
    const actor = await guards.requireActor();
    await guards.throttle(`trip-write:${actor.id}`, 100);
    const body = updateTripProfileRequest.safeParse(await request.json());
    if (!body.success)
      throw new AppError(
        "INVALID",
        "INVALID_PROFILE",
        "Check dates, interests and party size.",
      );
    return success(
      await updateProfile.execute({
        id,
        owner: actor,
        expectedVersion: body.data.expectedVersion,
        profile: body.data.profile,
      }),
    );
  });
}
