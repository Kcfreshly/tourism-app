import { AppError } from "@/shared/application/app-error";
import {
  holdMinutes,
  paymentReference,
  priceVersion,
  type StartCheckoutInput,
} from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import {
  PaymentProviderUnavailable,
  type PaymentGateway,
} from "../ports/payment-gateway";
import type { CartPricing } from "../services/cart-pricing";

export type StartedCheckout =
  | { status: "PAYMENT_REDIRECT"; authorizationUrl: string; reference: string }
  | { status: "PAID"; orderReference: string };

const providerDown = () =>
  new AppError(
    "UNAVAILABLE",
    "PAYMENT_PROVIDER_UNAVAILABLE",
    `We couldn’t reach the payment page. Your places are held for ${holdMinutes} minutes; press Pay again.`,
  );

// Pay pressed: reprice on the server, hold the places, then open a payment
// with the provider. One Idempotency-Key per press, so a double press or a
// retry after a timeout continues the same checkout instead of a second one.
export class StartCheckout {
  constructor(
    private readonly pricing: CartPricing,
    private readonly checkouts: CheckoutRepository,
    private readonly gateway: () => PaymentGateway,
    private readonly callbackUrl: () => string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: {
    user: { id: string; email: string };
    idempotencyKey: string;
    input: StartCheckoutInput;
  }): Promise<StartedCheckout> {
    const now = this.clock();
    const existing = await this.checkouts.findByIdempotencyKey(
      command.idempotencyKey,
    );
    if (existing) {
      if (existing.checkout.userId !== command.user.id)
        throw new AppError(
          "CONFLICT",
          "IDEMPOTENCY_KEY_REUSED",
          "Reload the page and press Pay again.",
        );
      return this.resume(existing, command.user.email, now);
    }

    const { quote, held } = await this.pricing.price(command.input.lines, now);
    const unavailable = quote.lines.filter((l) => l.problem);
    if (unavailable.length)
      throw new AppError(
        "CONFLICT",
        "LINE_UNAVAILABLE",
        "Some items can’t be booked as they are. Check them in your cart.",
        { quote },
      );
    if (quote.totals.totalMinor !== command.input.shownTotalMinor)
      throw new AppError(
        "CONFLICT",
        "PRICE_CHANGED",
        "Prices changed since you opened checkout. Check the new total.",
        { quote },
      );

    const checkoutId = crypto.randomUUID();
    const hold = await this.checkouts.hold(
      {
        id: checkoutId,
        userId: command.user.id,
        idempotencyKey: command.idempotencyKey,
        contact: { ...command.input.contact, email: command.user.email },
        ...quote.totals,
        currency: "NGN",
        priceVersion,
        expiresAt: new Date(now.getTime() + holdMinutes * 60000),
        lines: held,
      },
      now,
    );
    if (!hold.held) {
      const line = quote.lines.find((l) => l.id === hold.cartLineId);
      throw new AppError(
        "CONFLICT",
        "CAPACITY_UNAVAILABLE",
        `${line?.title ?? "An item"} just sold out for that date. Choose another date or remove it.`,
        { cartLineId: hold.cartLineId, remaining: hold.remaining },
      );
    }
    return this.openPayment(
      checkoutId,
      quote.totals.totalMinor,
      command.user.email,
    );
  }

  private async resume(
    existing: NonNullable<
      Awaited<ReturnType<CheckoutRepository["findByIdempotencyKey"]>>
    >,
    email: string,
    now: Date,
  ): Promise<StartedCheckout> {
    const { checkout, payment } = existing;
    if (checkout.status === "PAID" && existing.orderReference)
      return { status: "PAID", orderReference: existing.orderReference };
    const open =
      ["HELD", "PAYMENT_PENDING"].includes(checkout.status) &&
      checkout.expiresAt > now;
    if (!open)
      throw new AppError(
        "CONFLICT",
        "CHECKOUT_EXPIRED",
        "This checkout has ended. Review your cart and press Pay again.",
      );
    if (payment?.authorizationUrl)
      return {
        status: "PAYMENT_REDIRECT",
        authorizationUrl: payment.authorizationUrl,
        reference: payment.reference,
      };
    // Held, but the provider didn't answer last time.
    return this.openPayment(checkout.id, checkout.totalMinor, email);
  }

  private async openPayment(
    checkoutId: string,
    amountMinor: number,
    email: string,
  ): Promise<StartedCheckout> {
    const gateway = this.gateway();
    const reference = paymentReference();
    let opened;
    try {
      opened = await gateway.initialize({
        reference,
        amountMinor,
        currency: "NGN",
        email,
        callbackUrl: this.callbackUrl(),
        metadata: { checkoutId },
      });
    } catch (e) {
      if (e instanceof PaymentProviderUnavailable) throw providerDown();
      throw e;
    }
    await this.checkouts.attachPayment(checkoutId, {
      reference,
      provider: gateway.provider,
      accessCode: opened.accessCode,
      authorizationUrl: opened.authorizationUrl,
      amountMinor,
      currency: "NGN",
    });
    return {
      status: "PAYMENT_REDIRECT",
      authorizationUrl: opened.authorizationUrl,
      reference,
    };
  }
}
