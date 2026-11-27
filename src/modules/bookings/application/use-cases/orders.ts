import { AppError } from "@/shared/application/app-error";
import type { OrderView, Viewer } from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { OrderLinks } from "../services/order-links";
import { noTripDetails, type TripDetails } from "../ports/trip-details";
// Marks overdue services and unconfirmed bookings before a read, so pages
// never show "waiting" past a deadline.
type Expirer = { execute(): Promise<unknown> };

// The traveller's paid orders, newest first, each with its bookings and
// services. Guest orders made in this browser are included. Overdue services
// are marked first, so the page never shows "finding your driver" past the
// deadline.
export class ListOrders {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: Expirer,
  ) {}

  async execute(viewer: Viewer) {
    await this.expire.execute();
    return this.checkouts.listOrders(viewer);
  }
}

// One order, with the paid trip's current profile for the fulfilment
// tracker: the flight, and what to look for when Fastlife books the stay.
export class GetOrder {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly expire: Expirer,
    private readonly links: OrderLinks,
    private readonly trips: TripDetails = noTripDetails,
  ) {}

  private async withTrip(order: OrderView) {
    if (!order.tripId) return order;
    const trip = (await this.trips.arrangements([order.tripId])).get(
      order.tripId,
    );
    return trip ? { ...order, trip } : order;
  }

  async execute(viewer: Viewer, reference: string) {
    await this.expire.execute();
    const order = await this.checkouts.findOrder(viewer, reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return this.withTrip(order);
  }

  // The link from the confirmation email opens the order on any device.
  async withLink(reference: string, key: string | undefined) {
    if (!this.links.verify(reference, key))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    await this.expire.execute();
    const order = await this.checkouts.findOrderByReference(reference);
    if (!order)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    return this.withTrip(order);
  }
}
