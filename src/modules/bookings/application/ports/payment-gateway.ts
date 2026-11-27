// The payment provider (Paystack, or the local simulation). Use cases only
// see this, so tests use a fake and the provider can change later.
export type VerifiedPayment = {
  status: "SUCCESS" | "FAILED" | "ABANDONED" | "REVERSED" | "PENDING";
  amountMinor: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  payload: unknown;
};

export interface PaymentGateway {
  readonly provider: string;
  initialize(input: {
    reference: string;
    amountMinor: number;
    currency: string;
    email: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ authorizationUrl: string; accessCode: string | null }>;
  verify(reference: string): Promise<VerifiedPayment>;
}

// Thrown when the provider can't be reached or answers with an error. The
// payment may still have gone through; callers verify again later.
export class PaymentProviderUnavailable extends Error {}
