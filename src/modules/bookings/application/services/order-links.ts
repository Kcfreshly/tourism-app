import { createHmac, timingSafeEqual } from "node:crypto";

// The link in the confirmation email. It carries an HMAC of the order
// reference, so it opens that one order on any device without an account or
// the guest browser's key. Anyone holding the email can see the order, the
// same as holding a paper ticket.
export class OrderLinks {
  constructor(
    private readonly secret: () => string,
    private readonly baseUrl: () => string,
  ) {}

  key(reference: string) {
    return createHmac("sha256", this.secret())
      .update(`order-link:${reference}`)
      .digest("base64url");
  }

  url(reference: string) {
    return `${this.baseUrl()}/bookings/${encodeURIComponent(reference)}?k=${this.key(reference)}`;
  }

  verify(reference: string, key: string | undefined) {
    if (!key) return false;
    const expected = Buffer.from(this.key(reference));
    const given = Buffer.from(key);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
