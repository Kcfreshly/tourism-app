import { AppError } from "@/shared/application/app-error";
import type { CheckoutRepository } from "../ports/checkout-repository";

// The traveller's paid orders, newest first, each with its bookings.
export class ListOrders {
  constructor(private readonly checkouts: CheckoutRepository) {}

  execute(userId: string) {
    return this.checkouts.listOrders(userId);
  }
}

export class GetOrder {
  constructor(private readonly checkouts: CheckoutRepository) {}

  async execute(userId: string, reference: string) {
    const order = await this.checkouts.findOrder(userId, reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return order;
  }
}
