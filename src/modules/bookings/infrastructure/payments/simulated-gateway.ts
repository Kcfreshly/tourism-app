import type {
  PaymentGateway,
  VerifiedPayment,
} from "../../application/ports/payment-gateway";

type Attempt = {
  amountMinor: number;
  currency: string;
  outcome?: "SUCCESS" | "FAILED";
  at?: Date;
};

// Payments kept in this process's memory, so a dev server restart forgets
// unfinished ones; they then stay pending until their hold lapses.
const attempts = ((
  globalThis as unknown as { simulatedPayments?: Map<string, Attempt> }
).simulatedPayments ??= new Map());

// Local stand-in for Paystack (PAYMENT_PROVIDER=simulated): the "payment
// page" is /checkout/simulated in this app, where the traveller chooses to
// succeed or fail. Refused in production by paymentSettings().
export class SimulatedGateway implements PaymentGateway {
  readonly provider = "SIMULATED";

  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    attempts.set(input.reference, {
      amountMinor: input.amountMinor,
      currency: input.currency,
    });
    return {
      authorizationUrl: `/checkout/simulated?reference=${encodeURIComponent(input.reference)}`,
      accessCode: null,
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const a = attempts.get(reference);
    return {
      status: a?.outcome ?? "PENDING",
      amountMinor: a?.amountMinor ?? 0,
      currency: a?.currency ?? "NGN",
      channel: a?.outcome ? "simulated" : null,
      paidAt: a?.outcome === "SUCCESS" ? (a.at ?? null) : null,
      payload: { simulated: true, outcome: a?.outcome ?? null },
    };
  }

  complete(reference: string, outcome: "SUCCESS" | "FAILED") {
    const a = attempts.get(reference);
    if (!a || a.outcome) return false;
    a.outcome = outcome;
    a.at = new Date();
    return true;
  }
}
