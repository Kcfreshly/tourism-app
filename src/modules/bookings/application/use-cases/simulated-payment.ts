import { canView, type Viewer } from "../../domain/checkout";
import type { CheckoutRepository } from "../ports/checkout-repository";

// The local stand-in for the provider's hosted page.
export interface SimulatedPayments {
  complete(reference: string, outcome: "SUCCESS" | "FAILED"): boolean;
}

// The simulated payment page (PAYMENT_PROVIDER=simulated): shows the
// traveller their own pending payment and records the outcome they choose.
export class SimulatedPayment {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly payments: SimulatedPayments,
    private readonly active: () => boolean,
  ) {}

  private async own(viewer: Viewer, reference: string) {
    if (!this.active()) return null;
    const found = await this.checkouts.findByPaymentReference(reference);
    return found?.payment && canView(found.checkout, viewer) ? found : null;
  }

  async view(viewer: Viewer, reference: string) {
    const found = await this.own(viewer, reference);
    return found?.payment
      ? {
          reference,
          amountMinor: found.payment.amountMinor,
          email: found.checkout.contactEmail,
          open: found.payment.status === "INITIALISED",
        }
      : null;
  }

  async complete(
    viewer: Viewer,
    reference: string,
    outcome: "SUCCESS" | "FAILED",
  ) {
    if (!(await this.own(viewer, reference))) return false;
    return this.payments.complete(reference, outcome);
  }
}
