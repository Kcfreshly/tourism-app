import {
  bookingDecidedEmail,
  orderPaidEmail,
  serviceUpdateEmail,
  stayOfferedEmail,
} from "../../domain/order-email";
import type { Notifier } from "../ports/notifier";
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

// Failed sends are logged, never thrown: the order page has the update.
async function sendSafely(
  event: string,
  ref: string,
  send: () => Promise<unknown>,
) {
  try {
    await send();
    return true;
  } catch (e) {
    console.error(
      JSON.stringify({
        event,
        orderReference: ref,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return false;
  }
}

// Tells the traveller who their driver or guide is, or that nobody could
// be matched in time and a refund is due.
export class SendServiceUpdate {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly mailer: () => Mailer,
    private readonly links: OrderLinks,
  ) {}

  execute(event: Parameters<Notifier["serviceUpdated"]>[0]) {
    return sendSafely(
      "SERVICE_EMAIL_FAILED",
      event.orderReference,
      async () => {
        const order = await this.checkouts.findOrderByReference(
          event.orderReference,
        );
        const email =
          order &&
          serviceUpdateEmail(
            {
              ...order,
              services: order.services.filter((s) => s.id === event.id),
            },
            event,
            this.links.url(order.reference),
          );
        if (email) await this.mailer().send(email);
      },
    );
  }
}

// Tells the traveller a stay is ready to approve and pay for.
export class SendStayOffered {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly mailer: () => Mailer,
    private readonly links: OrderLinks,
  ) {}

  execute(event: Parameters<Notifier["stayOffered"]>[0]) {
    return sendSafely("STAY_EMAIL_FAILED", event.orderReference, async () => {
      const order = await this.checkouts.findOrderByReference(
        event.orderReference,
      );
      if (order)
        await this.mailer().send(
          stayOfferedEmail(order, event.offer, this.links.url(order.reference)),
        );
    });
  }
}
