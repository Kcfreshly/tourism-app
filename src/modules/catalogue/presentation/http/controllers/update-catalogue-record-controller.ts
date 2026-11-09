import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { catalogueEditSchema } from "../../../domain/catalogue";
import type { UpdateCatalogueRecord } from "../../../application/use-cases/update-catalogue-record";

export function createUpdateCatalogueRecordController(
  guards: RequestGuards,
  updateRecord: UpdateCatalogueRecord,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`catalogue:${actor.id}`, 60);
    const parsed = catalogueEditSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_CATALOGUE",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    return success(
      await updateRecord.execute({ actorId: actor.id, edit: parsed.data }),
    );
  });
}
