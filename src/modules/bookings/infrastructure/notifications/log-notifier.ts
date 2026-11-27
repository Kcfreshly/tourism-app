import type { Notifier } from "../../application/ports/notifier";
import { serviceStatusLabel } from "../../domain/trip-checkout";

// Phase 1 (D8): no email provider yet. The audit trail already records each
// order; this makes the events visible in the server log as well.
export class LogNotifier implements Notifier {
  // The email is left out of the log; the order holds it.
  async orderPaid(event: Parameters<Notifier["orderPaid"]>[0]) {
    console.info(
      JSON.stringify({
        event: "ORDER_PAID",
        userId: event.userId,
        guest: !event.userId,
        orderReference: event.orderReference,
      }),
    );
  }

  async needsReview(event: { checkoutId: string; reason: string }) {
    console.warn(
      JSON.stringify({ event: "CHECKOUT_REQUIRES_REVIEW", ...event }),
    );
  }

  // The message the traveller will get, once a channel exists.
  async serviceUpdated(event: Parameters<Notifier["serviceUpdated"]>[0]) {
    console.info(
      JSON.stringify({
        event: "SERVICE_UPDATED",
        userId: event.userId,
        orderReference: event.orderReference,
        message: serviceStatusLabel(event.service, event.status),
      }),
    );
  }

  async stayOffered(event: Parameters<Notifier["stayOffered"]>[0]) {
    console.info(
      JSON.stringify({
        event: "STAY_OFFERED",
        orderReference: event.orderReference,
        offerId: event.offer.id,
      }),
    );
  }

  async bookingDecided(event: Parameters<Notifier["bookingDecided"]>[0]) {
    console.info(
      JSON.stringify({
        event: "BOOKING_DECIDED",
        bookingId: event.id,
        orderReference: event.orderReference,
        status: event.status,
      }),
    );
  }
}
