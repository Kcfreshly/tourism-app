import type { Notifier } from "../../application/ports/notifier";
import type {
  SendBookingUpdate,
  SendOrderReceipt,
  SendServiceUpdate,
  SendStayOffered,
} from "../../application/use-cases/order-receipt";

// Logs every event like LogNotifier, and emails the buyer when an order is
// paid (ConfirmPayment reports a new order once, so one email per order),
// when a partner confirms or declines a booking, when a driver or guide is
// matched (or can't be), and when a stay is ready to approve.
export class ReceiptNotifier implements Notifier {
  constructor(
    private readonly log: Notifier,
    private readonly receipt: SendOrderReceipt,
    private readonly update: SendBookingUpdate,
    private readonly services?: SendServiceUpdate,
    private readonly stays?: SendStayOffered,
  ) {}

  async orderPaid(event: Parameters<Notifier["orderPaid"]>[0]) {
    await this.log.orderPaid(event);
    await this.receipt.execute(event.orderReference);
  }

  needsReview(event: Parameters<Notifier["needsReview"]>[0]) {
    return this.log.needsReview(event);
  }

  async serviceUpdated(event: Parameters<Notifier["serviceUpdated"]>[0]) {
    await this.log.serviceUpdated(event);
    await this.services?.execute(event);
  }

  async stayOffered(event: Parameters<Notifier["stayOffered"]>[0]) {
    await this.log.stayOffered(event);
    await this.stays?.execute(event);
  }

  async bookingDecided(event: Parameters<Notifier["bookingDecided"]>[0]) {
    await this.log.bookingDecided(event);
    await this.update.execute(event);
  }
}
