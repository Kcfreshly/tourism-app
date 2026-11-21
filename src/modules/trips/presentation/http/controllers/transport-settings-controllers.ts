import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { transportSettingsSchema } from "../../../domain/transport-settings";
import type { GetTransportSettings } from "../../../application/use-cases/get-transport-settings";
import type { UpdateTransportSettings } from "../../../application/use-cases/update-transport-settings";

const updateSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    settings: transportSettingsSchema,
  })
  .strict();

export function createGetTransportSettingsController(
  guards: RequestGuards,
  getSettings: GetTransportSettings,
) {
  return controller(async () => {
    await guards.requireAdmin();
    return success(await getSettings.execute());
  });
}

export function createUpdateTransportSettingsController(
  guards: RequestGuards,
  updateSettings: UpdateTransportSettings,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`transport-settings:${actor.id}`, 30);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_TRANSPORT_SETTINGS",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    return success(
      await updateSettings.execute({ actorId: actor.id, ...parsed.data }),
    );
  });
}
