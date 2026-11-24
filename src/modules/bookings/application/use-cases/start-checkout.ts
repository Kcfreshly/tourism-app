import { AppError } from "@/shared/application/app-error";
import {
  holdMinutes,
  priceVersion,
  type StartCheckoutInput,
} from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { CartPricing } from "../services/cart-pricing";
import type {
  PaymentStarter,
  StartedCheckout,
} from "../services/payment-starter";

export type { StartedCheckout };

// Pay pressed: reprice on the server, hold the places, then open a payment
// with the provider. One Idempotency-Key per press, so a double press or a
// retry after a timeout continues the same checkout instead of a second one.
export class StartCheckout {
  constructor(
    private readonly pricing: CartPricing,
    private readonly checkouts: CheckoutRepository,
    private readonly payments: PaymentStarter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: {
    user: { id: string; email: string };
    idempotencyKey: string;
    input: StartCheckoutInput;
  }): Promise<StartedCheckout> {
    const now = this.clock();
    const earlier = await this.payments.resume(
      command.user,
      command.idempotencyKey,
      now,
    );
    if (earlier) return earlier;

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
        trip: null,
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
    return this.payments.open(
      checkoutId,
      quote.totals.totalMinor,
      command.user.email,
    );
  }
}
