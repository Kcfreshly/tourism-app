import { AppError } from "@/shared/application/app-error";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { ExpireOverdueServices } from "./service-requests";

// The traveller's paid orders, newest first, each with its bookings and
// services. Overdue services are marked first, so the page never shows
// "finding your driver" past the deadline.
export class ListOrders {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: ExpireOverdueServices,
  ) {}

  async execute(userId: string) {
    await this.expire.execute();
    return this.checkouts.listOrders(userId);
  }
}

export class GetOrder {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: ExpireOverdueServices,
  ) {}

  async execute(userId: string, reference: string) {
    await this.expire.execute();
    const order = await this.checkouts.findOrder(userId, reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return order;
  }
}
