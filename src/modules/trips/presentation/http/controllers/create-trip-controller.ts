import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { profileSchema } from "../../../domain/profile";
import type { CreateTrip } from "../../../application/use-cases/create-trip";

export function createCreateTripController(
  guards: RequestGuards,
  createTrip: CreateTrip,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_PROFILE",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    const actor = await guards.requireActor();
    await guards.throttle(`trip-create:${actor.id}`, 20);
    return success(await createTrip.execute(actor, parsed.data), 201);
  });
}
