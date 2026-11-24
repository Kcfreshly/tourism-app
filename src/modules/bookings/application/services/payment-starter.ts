import { AppError } from "@/shared/application/app-error";
import { canView, holdMinutes, paymentReference } from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import {
  PaymentProviderUnavailable,
  type PaymentGateway,
} from "../ports/payment-gateway";

export type StartedCheckout =
  | { status: "PAYMENT_REDIRECT"; authorizationUrl: string; reference: string }
  | { status: "PAID"; orderReference: string };

// The part of Pay shared by cart and trip checkout: continuing a press seen
// before (same Idempotency-Key), and opening a payment for a held checkout.
export class PaymentStarter {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly gateway: () => PaymentGateway,
    private readonly callbackUrl: () => string,
  ) {}

  // The earlier result of this press, or null if it is new. Only the same
  // account, or for a guest the same browser, may continue it.
  async resume(
    user: { id: string | null; email: string; guestKeyHash?: string | null },
    idempotencyKey: string,
    now: Date,
  ): Promise<StartedCheckout | null> {
    const existing = await this.checkouts.findByIdempotencyKey(idempotencyKey);
    if (!existing) return null;
    const { checkout, payment } = existing;
    const owner = {
      userId: user.id,
      guestKeyHash: user.id ? null : (user.guestKeyHash ?? null),
    };
    if (!canView(checkout, owner))
      throw new AppError(
        "CONFLICT",
        "IDEMPOTENCY_KEY_REUSED",
        "Reload the page and press Pay again.",
      );
    if (checkout.status === "PAID" && existing.orderReference)
      return { status: "PAID", orderReference: existing.orderReference };
    const open =
      ["HELD", "PAYMENT_PENDING"].includes(checkout.status) &&
      checkout.expiresAt > now;
    if (!open)
      throw new AppError(
        "CONFLICT",
        "CHECKOUT_EXPIRED",
        "This checkout has ended. Review it and press Pay again.",
      );
    if (payment?.authorizationUrl)
      return {
        status: "PAYMENT_REDIRECT",
        authorizationUrl: payment.authorizationUrl,
        reference: payment.reference,
      };
    // Held, but the provider didn't answer last time.
    return this.open(checkout.id, checkout.totalMinor, user.email);
  }

  async open(
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
      if (e instanceof PaymentProviderUnavailable)
        throw new AppError(
          "UNAVAILABLE",
          "PAYMENT_PROVIDER_UNAVAILABLE",
          `We couldn’t reach the payment page. Your places are held for ${holdMinutes} minutes; press Pay again.`,
        );
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
