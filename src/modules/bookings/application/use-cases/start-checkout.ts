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
    // A guest has no id: their browser's key hash owns the checkout, and
    // every line must be an event whose partner allows guest checkout.
    user: { id: string | null; email: string; guestKeyHash?: string | null };
    idempotencyKey: string;
    input: StartCheckoutInput;
  }): Promise<StartedCheckout> {
    const now = this.clock();
    const owner = {
      userId: command.user.id,
      guestKeyHash: command.user.id
        ? null
        : (command.user.guestKeyHash ?? null),
    };
    if (!owner.userId && !owner.guestKeyHash)
      throw new AppError(
        "UNAUTHENTICATED",
        "SIGN_IN_REQUIRED",
        "Sign in to pay.",
      );
    const earlier = await this.payments.resume(
      command.user,
      command.idempotencyKey,
      now,
    );
    if (earlier) return earlier;

    const { quote, held, guestCheckout } = await this.pricing.price(
      command.input.lines,
      now,
    );
    if (!owner.userId && !guestCheckout)
      throw new AppError(
        "UNAUTHENTICATED",
        "SIGN_IN_REQUIRED",
        "Sign in to book these. Only some event tickets can be bought without an account.",
      );
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
        ...owner,
        idempotencyKey: command.idempotencyKey,
        contact: {
          name: command.input.contact.name,
          phone: command.input.contact.phone,
          email: command.user.email,
        },
        ...quote.totals,
        currency: "NGN",
        priceVersion,
        expiresAt: new Date(now.getTime() + holdMinutes * 60000),
        trip: null,
        lines: held,
      },
      now,
    );
    if (!hold.held && "duplicateKey" in hold) {
      // Double press reaching the server at once: the other request won.
      const first = await this.payments.resume(
        command.user,
        command.idempotencyKey,
        now,
      );
      if (first) return first;
      throw new AppError(
        "CONFLICT",
        "IDEMPOTENCY_KEY_REUSED",
        "Reload the page and press Pay again.",
      );
    }
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
