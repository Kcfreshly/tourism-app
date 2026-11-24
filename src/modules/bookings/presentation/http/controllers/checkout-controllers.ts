import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import {
  startCheckoutSchema,
  startTripCheckoutSchema,
  type Viewer,
} from "../../../domain/checkout";
import { guestKeyFromCookies, guestKeyHash } from "../guest-key";
import type { StartCheckout } from "../../../application/use-cases/start-checkout";
import type { StartTripCheckout } from "../../../application/use-cases/start-trip-checkout";
import type { RecordPaymentEvent } from "../../../application/use-cases/record-payment-event";
import type { ConfirmOwnPayment } from "../../../application/use-cases/confirm-payment";
import type {
  GetOrder,
  ListOrders,
} from "../../../application/use-cases/orders";
import type { SimulatedPayment } from "../../../application/use-cases/simulated-payment";

const idempotencyKey = /^[A-Za-z0-9-]{16,64}$/;
const maxWebhookBytes = 64 * 1024;

const signIn = () =>
  new AppError("UNAUTHENTICATED", "SIGN_IN_REQUIRED", "Sign in to continue.");

// The signed-in account and this browser's guest key, either of which may
// own a checkout. Refuses a caller with neither.
async function viewerOf(guards: RequestGuards, request: Request) {
  const actor = await guards.currentActor();
  const viewer: Viewer = {
    userId: actor?.id ?? null,
    guestKeyHash: guestKeyHash(
      guestKeyFromCookies(request.headers.get("cookie")),
    ),
  };
  if (!viewer.userId && !viewer.guestKeyHash) throw signIn();
  return viewer;
}

// Throttle key: the account, or the address of a guest.
async function caller(guards: RequestGuards, viewer: Viewer) {
  return viewer.userId ?? `guest:${await guards.clientAddress()}`;
}

// The checks every Pay press passes: same origin, signed in (or, where
// allowed, a guest with the guest key cookie), payments on, throttled, an
// Idempotency-Key (one per press, reused when retrying it), a valid body and
// an email for the receipt: the account's, or the one a guest typed.
async function payPress<T extends { contact: { email?: string } }>(
  guards: RequestGuards,
  enabled: () => boolean,
  request: Request,
  schema: z.ZodType<T>,
  allowGuest = false,
) {
  await guards.checkOrigin();
  const actor = allowGuest
    ? await guards.currentActor()
    : await guards.requireActor();
  const guestHash = actor
    ? null
    : guestKeyHash(guestKeyFromCookies(request.headers.get("cookie")));
  if (!actor && !guestHash) throw signIn();
  if (!enabled())
    throw new AppError(
      "FORBIDDEN",
      "PAYMENTS_DISABLED",
      "Payments aren’t switched on in this preview.",
    );
  await guards.throttle(
    `checkout:${actor?.id ?? `guest:${await guards.clientAddress()}`}`,
    10,
  );
  const key = request.headers.get("idempotency-key") ?? "";
  if (!idempotencyKey.test(key))
    throw new AppError(
      "INVALID",
      "IDEMPOTENCY_KEY_REQUIRED",
      "Reload the page and press Pay again.",
    );
  const input = schema.safeParse(await request.json());
  if (!input.success)
    throw new AppError(
      "INVALID",
      "INVALID_CHECKOUT",
      actor
        ? "Add your name and a phone number, and agree to the terms."
        : "Add your name, email and a phone number, and agree to the terms.",
    );
  const email = actor ? actor.email : input.data.contact.email;
  if (!email)
    throw new AppError(
      "INVALID",
      "EMAIL_REQUIRED",
      actor
        ? "Your account needs an email address to pay."
        : "Add the email address your tickets should go to.",
    );
  return {
    user: actor
      ? { id: actor.id, email }
      : { id: null, email, guestKeyHash: guestHash },
    idempotencyKey: key,
    input: input.data,
  };
}

// POST /checkouts: Pay pressed on the cart. A guest may pay too; StartCheckout
// checks that every line is an event whose partner allows guest checkout.
export function createStartCheckoutController(deps: {
  guards: RequestGuards;
  start: StartCheckout;
  enabled: () => boolean;
}) {
  return controller(async (request: Request) =>
    success(
      await deps.start.execute(
        await payPress(
          deps.guards,
          deps.enabled,
          request,
          startCheckoutSchema,
          true,
        ),
      ),
      201,
    ),
  );
}

// POST /trips/{id}/checkout: Pay pressed on a planned trip. Needs an account.
export function createStartTripCheckoutController(deps: {
  guards: RequestGuards;
  start: StartTripCheckout;
  enabled: () => boolean;
}) {
  return controller(async (request: Request, { params }: IdParams) => {
    const press = await payPress(
      deps.guards,
      deps.enabled,
      request,
      startTripCheckoutSchema,
    );
    if (!press.user.id) throw signIn();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Trip not found.");
    return success(
      await deps.start.execute({
        ...press,
        user: { id: press.user.id, email: press.user.email },
        tripId: id,
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
// while PAYMENT_PROVIDER=simulated; only the traveller (or guest browser) who
// started it can complete it.
export function createSimulatedPaymentController(deps: {
  guards: RequestGuards;
  simulated: SimulatedPayment;
}) {
  const { guards } = deps;
  return controller(async (request: Request) => {
    await guards.checkOrigin();
    const viewer = await viewerOf(guards, request);
    await guards.throttle(`simulated-pay:${await caller(guards, viewer)}`, 20);
    const input = simulatedSchema.safeParse(await request.json());
    if (!input.success)
      throw new AppError("INVALID", "INVALID_PAYMENT", "Choose an outcome.");
    const done = await deps.simulated.complete(
      viewer,
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
    const viewer = await viewerOf(guards, request);
    await guards.throttle(`payment-verify:${await caller(guards, viewer)}`, 30);
    const input = z
      .object({ reference: z.string().min(1).max(100) })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new AppError("INVALID", "INVALID_PAYMENT", "Send a reference.");
    return success(await deps.confirm.execute(viewer, input.data.reference));
  });
}

export function createOrderControllers(deps: {
  guards: RequestGuards;
  list: ListOrders;
  get: GetOrder;
}) {
  const { guards } = deps;
  return {
    list: controller(async (request: Request) => {
      return success(await deps.list.execute(await viewerOf(guards, request)));
    }),
    get: controller(async (request: Request, { params }: IdParams) => {
      return success(
        await deps.get.execute(
          await viewerOf(guards, request),
          (await params).id,
        ),
      );
    }),
  };
}
