import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { GetTrip } from "../../../application/use-cases/get-trip";
import { tripIdSchema } from "../schemas/trip-requests";

function draftNotFound() {
  return new AppError("NOT_FOUND", "NOT_FOUND", "Draft not found.");
}

export function createGetTripController(
  guards: RequestGuards,
  getTrip: GetTrip,
) {
  return controller(async (_: Request, { params }: IdParams) => {
    const { id } = await params;
    if (!tripIdSchema.safeParse(id).success) throw draftNotFound();
    return success(await getTrip.execute(id, await guards.requireActor()));
  });
}
