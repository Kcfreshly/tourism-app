import type { Notifier } from "../../application/ports/notifier";

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
}
