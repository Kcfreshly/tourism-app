import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { DeleteCatalogueRecord } from "../../../application/use-cases/delete-catalogue-record";
import type { ListCatalogueHistory } from "../../../application/use-cases/list-catalogue-history";
import type { ListDeletedListings } from "../../../application/use-cases/list-deleted-listings";
import type { RestoreCatalogueRecord } from "../../../application/use-cases/restore-catalogue-record";

const deleteSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();
const restoreSchema = z.object({ auditId: z.uuid() }).strict();

export function createDeleteCatalogueRecordController(
  guards: RequestGuards,
  remove: DeleteCatalogueRecord,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireSuperAdmin();
    await guards.throttle(`catalogue-delete:${actor.id}`, 20);
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_DELETE",
        "Send the listing id, its version and an optional reason.",
      );
    return success(
      await remove.execute({
        actorId: actor.id,
        id: parsed.data.id,
        expectedVersion: parsed.data.expectedVersion,
        reason: parsed.data.reason || null,
      }),
    );
  });
}

export function createListDeletedListingsController(
  guards: RequestGuards,
  list: ListDeletedListings,
) {
  return controller(async () => {
    await guards.requireAdmin();
    return success(await list.execute());
  });
}

export function createRestoreCatalogueRecordController(
  guards: RequestGuards,
  restore: RestoreCatalogueRecord,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`catalogue-restore:${actor.id}`, 20);
    const parsed = restoreSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_RESTORE",
        "Send the audit event id of the deletion.",
      );
    return success(
      await restore.execute({
        actorId: actor.id,
        auditId: parsed.data.auditId,
      }),
      201,
    );
  });
}

export function createListCatalogueHistoryController(
  guards: RequestGuards,
  history: ListCatalogueHistory,
) {
  return controller(async (request: Request) => {
    await guards.requireAdmin();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!z.uuid().safeParse(id).success)
      throw new AppError("INVALID", "INVALID_ID", "Send a listing id.");
    return success(await history.execute(id));
  });
}
