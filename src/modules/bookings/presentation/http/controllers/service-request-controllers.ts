import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { serviceActionSchema } from "../../../domain/service-request";
import type {
  ListServiceQueue,
  UpdateServiceRequest,
} from "../../../application/use-cases/service-requests";

// GET / PATCH /admin/service-requests: staff match drivers and guides to
// paid trips, mark refunds due, and mark services completed.
export function createServiceRequestControllers(deps: {
  guards: RequestGuards;
  list: ListServiceQueue;
  update: UpdateServiceRequest;
}) {
  const { guards } = deps;
  return {
    list: controller(async () => {
      await guards.requireAdmin();
      return success(await deps.list.execute());
    }),
    update: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`service-request:${actor.id}`, 60);
      const input = serviceActionSchema.safeParse(await request.json());
      if (!input.success)
        throw new AppError(
          "INVALID",
          "INVALID_SERVICE_ACTION",
          input.error.issues[0]?.message ?? "Check the details and try again.",
        );
      return success(await deps.update.execute(actor.id, input.data));
    }),
  };
}
