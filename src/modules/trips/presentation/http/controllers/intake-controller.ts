import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { SuggestProfile } from "../../../application/use-cases/suggest-profile";
import { intakeRequest } from "../schemas/trip-requests";

export function createIntakeController(
  guards: RequestGuards,
  suggestProfile: SuggestProfile,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const input = intakeRequest.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_INTAKE",
        "Check your profile and keep the message under 3,000 characters.",
      );
    const actor = await guards.requireActor();
    await guards.throttle(`intake:${actor.id}`, 20);
    return success(
      suggestProfile.execute(input.data.profile, input.data.message),
    );
  });
}
