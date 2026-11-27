import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { packageEditSchema } from "../../../domain/packages";
import type { CreatePackageDraft } from "../../../application/use-cases/create-package-draft";
import type { ListPackageRecords } from "../../../application/use-cases/list-package-records";
import type { ListPublishedPackages } from "../../../application/use-cases/list-published-packages";
import type { UpdatePackage } from "../../../application/use-cases/update-package";

const createSchema = z
  .object({ title: z.string().trim().min(5).max(120) })
  .strict();

function issues(error: z.ZodError) {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message,
    )
    .join("; ");
}

export function createListPackagesController(list: ListPublishedPackages) {
  return controller(async () => success(await list.execute()));
}

export function createListPackageRecordsController(
  guards: RequestGuards,
  list: ListPackageRecords,
) {
  return controller(async () => {
    await guards.requireAdmin();
    return success(await list.execute());
  });
}

export function createCreatePackageDraftController(
  guards: RequestGuards,
  create: CreatePackageDraft,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`package-create:${actor.id}`, 15);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError(
        "INVALID",
        "INVALID_TITLE",
        "Enter a trip title of 5–120 characters.",
      );
    return success(
      await create.execute({ actorId: actor.id, title: parsed.data.title }),
      201,
    );
  });
}

export function createUpdatePackageController(
  guards: RequestGuards,
  update: UpdatePackage,
) {
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireAdmin();
    await guards.throttle(`package:${actor.id}`, 60);
    const parsed = packageEditSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppError("INVALID", "INVALID_PACKAGE", issues(parsed.error));
    return success(
      await update.execute({ actorId: actor.id, edit: parsed.data }),
    );
  });
}
