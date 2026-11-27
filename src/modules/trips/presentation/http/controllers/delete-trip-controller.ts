import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { DeleteTrip } from "../../../application/use-cases/delete-trip";
import { tripIdSchema } from "../schemas/trip-requests";

function draftNotFound() {
  return new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
}

export function createDeleteTripController(
  guards: RequestGuards,
  deleteTrip: DeleteTrip,
) {
  return controller(async (_: Request, { params }: IdParams) => {
    await guards.checkOrigin();
    const { id } = await params;
    if (!tripIdSchema.safeParse(id).success) throw draftNotFound();
    const actor = await guards.requireActor();
    await guards.throttle(`trip-write:${actor.id}`, 100);
    return success(await deleteTrip.execute(id, actor));
  });
}
