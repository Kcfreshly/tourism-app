import type { Notifier } from "../../application/ports/notifier";
import { serviceStatusLabel } from "../../domain/trip-checkout";

// Phase 1 (D8): no email provider yet. The audit trail already records each
// order; this makes the events visible in the server log as well.
export class LogNotifier implements Notifier {
  async orderPaid(event: { userId: string; orderReference: string }) {
    console.info(JSON.stringify({ event: "ORDER_PAID", ...event }));
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
}
