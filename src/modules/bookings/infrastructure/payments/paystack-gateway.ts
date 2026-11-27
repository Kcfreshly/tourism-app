import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentProviderUnavailable,
  type PaymentGateway,
  type VerifiedPayment,
} from "../../application/ports/payment-gateway";

const api = "https://api.paystack.co";
const timeoutMs = 10000;

const statuses: Record<string, VerifiedPayment["status"]> = {
  success: "SUCCESS",
  failed: "FAILED",
  abandoned: "ABANDONED",
  reversed: "REVERSED",
};

// Paystack's hosted payment page: card data never reaches our servers.
// Test keys only while the app is in demo mode (src/config/environment.ts).
export class PaystackGateway implements PaymentGateway {
  readonly provider = "PAYSTACK";

  constructor(private readonly secretKey: string) {}

  private async call(path: string, init?: RequestInit) {
    let response: Response;
    try {
      response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new PaymentProviderUnavailable(
        `Paystack unreachable: ${(e as Error).message}`,
      );
    }
    const body = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    } | null;
    if (!response.ok || !body?.status || !body.data)
      throw new PaymentProviderUnavailable(
        `Paystack ${path.split("/")[1]} failed (${response.status}): ${body?.message ?? "no body"}`,
      );
    return body.data;
  }

  async initialize(input: Parameters<PaymentGateway["initialize"]>[0]) {
    const data = await this.call("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
    return {
      authorizationUrl: String(data.authorization_url),
      accessCode: data.access_code ? String(data.access_code) : null,
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.call(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return {
      status: statuses[String(data.status)] ?? "PENDING",
      amountMinor: Number(data.amount),
      currency: String(data.currency),
      channel: data.channel ? String(data.channel) : null,
      paidAt: data.paid_at ? new Date(String(data.paid_at)) : null,
      payload: {
        id: data.id,
        status: data.status,
        gateway_response: data.gateway_response,
        channel: data.channel,
        paid_at: data.paid_at,
      },
    };
  }
}

// Paystack signs each webhook body with HMAC-SHA512 of the secret key.
export function paystackSignatureValid(
  secretKey: string,
  rawBody: string,
  signature: string | null,
) {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
