import type { Notifier } from "../../application/ports/notifier";
import type { SendOrderReceipt } from "../../application/use-cases/order-receipt";

// Logs every event like LogNotifier, and emails the buyer when an order is
// paid. ConfirmPayment only reports a new order once, so one email per order.
export class ReceiptNotifier implements Notifier {
  constructor(
    private readonly log: Notifier,
    private readonly receipt: SendOrderReceipt,
  ) {}

  async orderPaid(event: Parameters<Notifier["orderPaid"]>[0]) {
    await this.log.orderPaid(event);
    await this.receipt.execute(event.orderReference);
  }

  needsReview(event: Parameters<Notifier["needsReview"]>[0]) {
    return this.log.needsReview(event);
  }

  serviceUpdated(event: Parameters<Notifier["serviceUpdated"]>[0]) {
    return this.log.serviceUpdated(event);
  }
}
