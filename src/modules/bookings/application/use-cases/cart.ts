import { AppError } from "@/shared/application/app-error";
import type { CartLine } from "../../domain/cart";
import type { CartRepository } from "../ports/cart-repository";
import type { CartPricing } from "../services/cart-pricing";

export class GetCart {
  constructor(private readonly carts: CartRepository) {}

  execute(userId: string) {
    return this.carts.load(userId);
  }
}

// Lines are stored as sent, even ones with a problem: the cart page shows
// them with what to fix. Checkout re-checks everything.
export class SaveCart {
  constructor(private readonly carts: CartRepository) {}

  async execute(command: {
    userId: string;
    lines: CartLine[];
    expectedVersion: number;
  }) {
    const saved = await this.carts.save(
      command.userId,
      command.lines,
      command.expectedVersion,
    );
    if (!saved)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Your cart changed on another device. Reload and try again.",
      );
    return saved;
  }
}

// The server's price and availability for lines, shown before Pay.
export class QuoteCart {
  constructor(
    private readonly pricing: CartPricing,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(lines: CartLine[]) {
    return (await this.pricing.price(lines, this.clock())).quote;
  }
}
