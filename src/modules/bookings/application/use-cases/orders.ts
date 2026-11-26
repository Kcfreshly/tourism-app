import { AppError } from "@/shared/application/app-error";
import type { Viewer } from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { OrderLinks } from "../services/order-links";
import type { ExpireOverdueServices } from "./service-requests";

// The traveller's paid orders, newest first, each with its bookings and
// services. Guest orders made in this browser are included. Overdue services
// are marked first, so the page never shows "finding your driver" past the
// deadline.
export class ListOrders {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: ExpireOverdueServices,
  ) {}

  async execute(viewer: Viewer) {
    await this.expire.execute();
    return this.checkouts.listOrders(viewer);
  }
}

export class GetOrder {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: ExpireOverdueServices,
    private readonly links: OrderLinks,
  ) {}

  async execute(viewer: Viewer, reference: string) {
    await this.expire.execute();
    const order = await this.checkouts.findOrder(viewer, reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return order;
  }

  // The link from the confirmation email opens the order on any device.
  async withLink(reference: string, key: string | undefined) {
    if (!this.links.verify(reference, key))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    await this.expire.execute();
    const order = await this.checkouts.findOrderByReference(reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return order;
  }
}
