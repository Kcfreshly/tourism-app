import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { CreateCatalogueDraft } from "../../../application/use-cases/create-catalogue-draft";

export function createCreateCatalogueDraftController(
  guards: RequestGuards,
  createDraft: CreateCatalogueDraft,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`catalogue-create:${actor.id}`, 15);
    const body = await request.json();
    if (
      typeof body.name !== "string" ||
      body.name.length < 5 ||
      body.name.length > 100
    )
      throw new AppError(
        "INVALID",
        "INVALID_NAME",
        "Enter a draft name of 5–100 characters.",
      );
    return success(
      await createDraft.execute({ actorId: actor.id, name: body.name }),
      201,
    );
  });
}
