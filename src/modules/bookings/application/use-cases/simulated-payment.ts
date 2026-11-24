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

  private async own(userId: string, reference: string) {
    if (!this.active()) return null;
    const found = await this.checkouts.findByPaymentReference(reference);
    return found?.payment && found.checkout.userId === userId ? found : null;
  }

  async view(userId: string, reference: string) {
    const found = await this.own(userId, reference);
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
    userId: string,
    reference: string,
    outcome: "SUCCESS" | "FAILED",
  ) {
    if (!(await this.own(userId, reference))) return false;
    return this.payments.complete(reference, outcome);
  }
}
