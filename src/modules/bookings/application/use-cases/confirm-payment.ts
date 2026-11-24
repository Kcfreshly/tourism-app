import { AppError } from "@/shared/application/app-error";
import {
  defaultCommissionBps,
  initialBookingStatus,
  orderReference,
} from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import {
  PaymentProviderUnavailable,
  type PaymentGateway,
} from "../ports/payment-gateway";
import type { Notifier } from "../ports/notifier";

export type PaymentState =
  | { status: "PAID"; orderReference: string }
  | { status: "PENDING" }
  | { status: "FAILED" }
  | { status: "REQUIRES_REVIEW" }
  | { status: "UNKNOWN" };

// Turns a verified payment into an order with one booking per line. The
// webhook, the return page and (later) the reconciler all call this, in any
// order and any number of times; each payment makes one order at most.
export class ConfirmPayment {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly gateway: () => PaymentGateway,
    private readonly notifier: Notifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(reference: string): Promise<PaymentState> {
    const found = await this.checkouts.findByPaymentReference(reference);
    // Only our own references; anything else is ignored.
    if (!found?.payment) return { status: "UNKNOWN" };
    const { checkout, payment } = found;
    if (checkout.status === "PAID" && found.orderReference)
      return { status: "PAID", orderReference: found.orderReference };
    if (checkout.status === "REQUIRES_REVIEW")
      return { status: "REQUIRES_REVIEW" };

    let verified;
    try {
      verified = await this.gateway().verify(reference);
    } catch (e) {
      if (e instanceof PaymentProviderUnavailable) return { status: "PENDING" };
      throw e;
    }
    const now = this.clock();
    if (verified.status === "PENDING") return { status: "PENDING" };
    if (verified.status !== "SUCCESS") {
      // An abandoned payment page can still be completed while the hold lasts.
      if (verified.status === "ABANDONED" && checkout.expiresAt > now)
        return { status: "PENDING" };
      await this.checkouts.recordFailure(
        reference,
        verified.status,
        verified.payload,
      );
      return { status: "FAILED" };
    }

    if (
      verified.amountMinor !== payment.amountMinor ||
      verified.currency !== payment.currency ||
      payment.amountMinor !== checkout.totalMinor
    )
      return this.review(checkout.id, "AMOUNT_MISMATCH");

    const settled = await this.checkouts.settle({
      reference,
      paidAt: verified.paidAt ?? now,
      channel: verified.channel,
      payload: verified.payload,
      now,
      orderReference,
      plan: (lines) =>
        lines.map((line) => ({
          checkoutLineId: line.id,
          ...initialBookingStatus(line.terms, verified.paidAt ?? now),
          commissionBps: line.partnerId ? defaultCommissionBps : null,
        })),
    });
    if (settled.status === "REQUIRES_REVIEW") {
      await this.notifier.needsReview({
        checkoutId: checkout.id,
        reason: settled.reason,
      });
      return { status: "REQUIRES_REVIEW" };
    }
    if (settled.created)
      await this.notifier.orderPaid({
        userId: checkout.userId,
        orderReference: settled.orderReference,
      });
    return { status: "PAID", orderReference: settled.orderReference };
  }

  private async review(checkoutId: string, reason: string) {
    await this.checkouts.markReview(checkoutId, reason);
    await this.notifier.needsReview({ checkoutId, reason });
    return { status: "REQUIRES_REVIEW" as const };
  }
}

// The return page: only the traveller who paid may confirm and see it.
export class ConfirmOwnPayment {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly confirm: ConfirmPayment,
  ) {}

  async execute(userId: string, reference: string) {
    const found = await this.checkouts.findByPaymentReference(reference);
    if (!found || found.checkout.userId !== userId)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Payment not found.");
    return this.confirm.execute(reference);
  }
}
