import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import {
  sendStayOfferSchema,
  withdrawStayOfferSchema,
} from "../../../domain/stay-offer";
import type {
  ListStayOrders,
  SendStayOfferToTrip,
  WithdrawStayOffer,
} from "../../../application/use-cases/stay-offers";

// GET / POST / PATCH /admin/stay-offers: staff see paid trips, send places
// to stay into them, and withdraw an offer that is no longer available.
export function createStayOfferControllers(deps: {
  guards: RequestGuards;
  list: ListStayOrders;
  send: SendStayOfferToTrip;
  withdraw: WithdrawStayOffer;
}) {
  const { guards } = deps;
  return {
    list: controller(async () => {
      await guards.requireAdmin();
      return success(await deps.list.execute());
    }),
    send: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`stay-offer:${actor.id}`, 60);
      const input = sendStayOfferSchema.safeParse(await request.json());
      if (!input.success)
        throw new AppError(
          "INVALID",
          "INVALID_STAY_OFFER",
          input.error.issues[0]?.message ?? "Check the offer and try again.",
        );
      return success(await deps.send.execute(actor.id, input.data), 201);
    }),
    withdraw: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`stay-offer:${actor.id}`, 60);
      const input = withdrawStayOfferSchema.safeParse(await request.json());
      if (!input.success)
        throw new AppError(
          "INVALID",
          "INVALID_STAY_OFFER",
          "Send the offer id and version.",
        );
      return success(await deps.withdraw.execute(actor.id, input.data));
    }),
  };
}
