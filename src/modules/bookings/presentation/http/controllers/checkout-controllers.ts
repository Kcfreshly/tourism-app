import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { startCheckoutSchema } from "../../../domain/checkout";
import type { StartCheckout } from "../../../application/use-cases/start-checkout";
import type { RecordPaymentEvent } from "../../../application/use-cases/record-payment-event";
import type { ConfirmOwnPayment } from "../../../application/use-cases/confirm-payment";
import type {
  GetOrder,
  ListOrders,
} from "../../../application/use-cases/orders";
import type { SimulatedPayment } from "../../../application/use-cases/simulated-payment";

const idempotencyKey = /^[A-Za-z0-9-]{16,64}$/;
const maxWebhookBytes = 64 * 1024;

// POST /checkouts: Pay pressed. Needs an Idempotency-Key header, one per
// press, reused when retrying the same press.
export function createStartCheckoutController(deps: {
  guards: RequestGuards;
  start: StartCheckout;
  enabled: () => boolean;
}) {
  const { guards } = deps;
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireActor();
    if (!deps.enabled())
      throw new AppError(
        "FORBIDDEN",
        "PAYMENTS_DISABLED",
        "Payments aren’t switched on in this preview.",
      );
    await guards.throttle(`checkout:${actor.id}`, 10);
    const key = request.headers.get("idempotency-key") ?? "";
    if (!idempotencyKey.test(key))
      throw new AppError(
        "INVALID",
        "IDEMPOTENCY_KEY_REQUIRED",
        "Reload the page and press Pay again.",
      );
    const input = startCheckoutSchema.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_CHECKOUT",
        "Add your name and a phone number, and agree to the terms.",
      );
    if (!actor.email)
      throw new AppError(
        "INVALID",
        "EMAIL_REQUIRED",
        "Your account needs an email address to pay.",
      );
    return success(
      await deps.start.execute({
        user: { id: actor.id, email: actor.email },
        idempotencyKey: key,
        input: input.data,
      }),
      201,
    );
  });
}

// POST /payments/paystack/webhook: the only unauthenticated write. The
// signature is what protects it; a bad one is refused before anything is read.
export function createPaystackWebhookController(deps: {
  record: RecordPaymentEvent;
  signatureValid: (rawBody: string, signature: string | null) => boolean;
}) {
  return async (request: Request) => {
    if (Number(request.headers.get("content-length")) > maxWebhookBytes)
      return new Response(null, { status: 413 });
    const raw = await request.text();
    if (
      raw.length > maxWebhookBytes ||
      !deps.signatureValid(raw, request.headers.get("x-paystack-signature"))
    )
      return new Response(null, { status: 401 });
    let payload: { event?: unknown; data?: { reference?: unknown } };
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response(null, { status: 400 });
    }
    try {
      await deps.record.execute({
        provider: "PAYSTACK",
        event: String(payload.event ?? "unknown"),
        reference:
          typeof payload.data?.reference === "string"
            ? payload.data.reference
            : null,
        payloadSha256: createHash("sha256").update(raw).digest("hex"),
        payload,
      });
      return new Response(null, { status: 200 });
    } catch {
      // Not handled: Paystack retries, and the stored event is picked up again.
      return new Response(null, { status: 500 });
    }
  };
}

const simulatedSchema = z
  .object({
    reference: z.string().min(1).max(100),
    outcome: z.enum(["SUCCESS", "FAILED"]),
  })
  .strict();

// POST /payments/simulated: the local payment page's buttons. Only exists
// while PAYMENT_PROVIDER=simulated; only the traveller who started it can
// complete it.
export function createSimulatedPaymentController(deps: {
  guards: RequestGuards;
  simulated: SimulatedPayment;
}) {
  const { guards } = deps;
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireActor();
    await guards.throttle(`simulated-pay:${actor.id}`, 20);
    const input = simulatedSchema.safeParse(await request.json());
    if (!input.success)
      throw new AppError("INVALID", "INVALID_PAYMENT", "Choose an outcome.");
    const done = await deps.simulated.complete(
      actor.id,
      input.data.reference,
      input.data.outcome,
    );
    if (!done)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Payment not found.");
    return success({ reference: input.data.reference });
  });
}

// POST /payments/verify: the return page asking again while a payment is
// still being confirmed.
export function createVerifyPaymentController(deps: {
  guards: RequestGuards;
  confirm: ConfirmOwnPayment;
}) {
  const { guards } = deps;
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const actor = await guards.requireActor();
    await guards.throttle(`payment-verify:${actor.id}`, 30);
    const input = z
      .object({ reference: z.string().min(1).max(100) })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new AppError("INVALID", "INVALID_PAYMENT", "Send a reference.");
    return success(await deps.confirm.execute(actor.id, input.data.reference));
  });
}

export function createOrderControllers(deps: {
  guards: RequestGuards;
  list: ListOrders;
  get: GetOrder;
}) {
  const { guards } = deps;
  return {
    list: controller(async () => {
      const actor = await guards.requireActor();
      return success(await deps.list.execute(actor.id));
    }),
    get: controller(async (_: Request, { params }: IdParams) => {
      const actor = await guards.requireActor();
      return success(await deps.get.execute(actor.id, (await params).id));
    }),
  };
}
