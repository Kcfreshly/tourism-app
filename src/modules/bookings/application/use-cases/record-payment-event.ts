import type {
  CheckoutRepository,
  PaymentEvent,
} from "../ports/checkout-repository";
import type { ConfirmPayment } from "./confirm-payment";

// A provider webhook whose signature has been checked. Stored first, then
// acted on; a repeat delivery of a handled event does nothing. A failure
// leaves the event unprocessed and rethrows, so the provider retries.
export class RecordPaymentEvent {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly confirm: ConfirmPayment,
  ) {}

  async execute(event: PaymentEvent) {
    const id = await this.checkouts.recordEvent(event);
    if (!id) return { handled: false };
    try {
      if (event.event === "charge.success" && event.reference)
        await this.confirm.execute(event.reference);
      await this.checkouts.finishEvent(id, null);
    } catch (e) {
      await this.checkouts
        .finishEvent(id, e instanceof Error ? e.message : String(e))
        .catch(() => {});
      throw e;
    }
    return { handled: true };
  }
}
