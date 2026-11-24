import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { cartLinesSchema, cartWriteSchema } from "../../../domain/cart";
import type {
  GetCart,
  QuoteCart,
  SaveCart,
} from "../../../application/use-cases/cart";

const quoteSchema = z.object({ lines: cartLinesSchema }).strict();

// The signed-in traveller's cart. Guests keep theirs in the browser until
// they sign in, when the browser merges it into this one.
export function createCartControllers(deps: {
  guards: RequestGuards;
  get: GetCart;
  save: SaveCart;
  quote: QuoteCart;
}) {
  const { guards } = deps;
  return {
    get: controller(async () => {
      const actor = await guards.requireActor();
      return success(await deps.get.execute(actor.id));
    }),
    save: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireActor();
      await guards.throttle(`cart-write:${actor.id}`, 60);
      const input = cartWriteSchema.safeParse(await request.json());
      if (!input.success)
        throw new AppError(
          "INVALID",
          "INVALID_CART",
          "Send up to 20 cart lines with unique ids and the cart version.",
        );
      return success(
        await deps.save.execute({ userId: actor.id, ...input.data }),
      );
    }),
    // A POST because the lines travel in the body; nothing is stored.
    quote: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireActor();
      await guards.throttle(`cart-quote:${actor.id}`, 60);
      const input = quoteSchema.safeParse(await request.json());
      if (!input.success)
        throw new AppError(
          "INVALID",
          "INVALID_CART",
          "Send up to 20 cart lines.",
        );
      return success(await deps.quote.execute(input.data.lines));
    }),
  };
}
