import { bookingDecidedEmail, orderPaidEmail } from "../../domain/order-email";
import type { PartnerBookingView } from "../../domain/partner-booking";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { Mailer } from "../ports/mailer";
import type { OrderLinks } from "../services/order-links";

// Emails the buyer their booking once payment is confirmed: to the account
// email, or for a guest the email typed at checkout. A failed send never
// undoes the payment; it is logged for staff, and the order page still has
// everything.
export class SendOrderReceipt {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly mailer: () => Mailer,
    private readonly links: OrderLinks,
  ) {}

  async execute(reference: string) {
    try {
      const order = await this.checkouts.findOrderByReference(reference);
      if (!order) return false;
      await this.mailer().send(
        orderPaidEmail(order, this.links.url(order.reference)),
      );
      return true;
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "ORDER_RECEIPT_FAILED",
          orderReference: reference,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return false;
    }
  }
}

// Tells the buyer their booking was confirmed, or declined with a refund due.
export class SendBookingUpdate {
  constructor(
    private readonly mailer: () => Mailer,
    private readonly links: OrderLinks,
  ) {}

  async execute(booking: PartnerBookingView) {
    if (booking.status !== "CONFIRMED" && booking.status !== "DECLINED")
      return false;
    try {
      await this.mailer().send(
        bookingDecidedEmail(booking, this.links.url(booking.orderReference)),
      );
      return true;
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "BOOKING_EMAIL_FAILED",
          bookingId: booking.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return false;
    }
  }
}
