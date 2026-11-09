import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { SaveWorkspace } from "../../../application/use-cases/save-workspace";
import type { OwnedTripLoader } from "../owned-trip";
import { saveWorkspaceRequest } from "../schemas/trip-requests";

export function createSaveWorkspaceController(
  guards: RequestGuards,
  ownedTrip: OwnedTripLoader,
  saveWorkspace: SaveWorkspace,
) {
  return controller(async (request: Request, { params }: IdParams) => {
    await guards.checkOrigin();
    const trip = await ownedTrip((await params).id);
    await guards.throttle(`trip-write:${trip.actor.id}`, 100);
    const input = saveWorkspaceRequest.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_SCHEDULE",
        "Check schedule dates, times and service windows.",
      );
    return success(await saveWorkspace.execute(trip, input.data));
  });
}
