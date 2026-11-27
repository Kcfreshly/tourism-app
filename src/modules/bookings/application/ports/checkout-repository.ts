import type { CartLine, PriceRow } from "../../domain/cart";
import type {
  BookingStatus,
  CheckoutStatus,
  OrderView,
  Viewer,
} from "../../domain/checkout";
import type { LineTerms, SlotRef } from "../../domain/resolve-line";
import type { ServiceLine } from "../../domain/trip-checkout";
import type { StayLine } from "../../domain/stay-offer";

// A line ready to hold: priced, with its slot and booked terms. A trip's
// car or guide has no slot; it becomes a service request when paid.
export type HeldLine = {
  line: CartLine | ServiceLine | StayLine;
  title: string;
  rows: PriceRow[];
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  terms: LineTerms;
  slot: SlotRef | null;
};

export type NewCheckout = {
  id: string;
  // A guest checkout has no account; its browser's key hash owns it.
  userId: string | null;
  guestKeyHash: string | null;
  idempotencyKey: string;
  contact: { name: string; email: string; phone: string };
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  currency: string;
  priceVersion: string;
  expiresAt: Date;
  // The planned trip and version this checkout pays for; null for a cart.
  trip: { id: string; version: number } | null;
  // Pays into this existing order (a stay) instead of creating one.
  orderId?: string | null;
  lines: HeldLine[];
};

export type HoldResult =
  | { held: true }
  | { held: false; cartLineId: string; remaining: number }
  // The same Idempotency-Key was stored by a request running at the same
  // time; continue that checkout instead.
  | { held: false; duplicateKey: true };

export type CheckoutPayment = {
  checkout: {
    id: string;
    userId: string | null;
    guestKeyHash: string | null;
    status: CheckoutStatus;
    totalMinor: number;
    currency: string;
    expiresAt: Date;
    contactEmail: string;
    reviewReason: string | null;
  };
  payment: {
    reference: string;
    provider: string;
    status: string;
    amountMinor: number;
    currency: string;
    authorizationUrl: string | null;
  } | null;
  orderReference: string | null;
};

// A stored checkout line, as settling needs it.
export type StoredLine = {
  id: string;
  cartLineId: string;
  partnerId: string | null;
  terms: LineTerms;
};

export type SettledLine = {
  checkoutLineId: string;
  status: BookingStatus;
  partnerDeadline: Date | null;
  commissionBps: number | null;
};

export type SettleRequest = {
  reference: string;
  paidAt: Date;
  channel: string | null;
  payload: unknown;
  now: Date;
  orderReference: () => string;
  // Decides each booking's starting status, for lines that hold places;
  // runs inside the transaction. Service lines become service requests.
  plan: (lines: StoredLine[]) => SettledLine[];
};

export type SettleResult =
  | { status: "PAID"; orderReference: string; created: boolean }
  | { status: "REQUIRES_REVIEW"; reason: string };

export type PaymentEvent = {
  provider: string;
  event: string;
  reference: string | null;
  payloadSha256: string;
  payload: unknown;
};

export interface CheckoutRepository {
  // Places left per slot (keyed by slotKey): the slot's current capacity
  // minus paid bookings and unexpired holds.
  remaining(slots: SlotRef[], now: Date): Promise<Map<string, number>>;
  // In one transaction: lapses this traveller's (or guest browser's) other
  // open holds, locks the
  // slots in id order, re-checks capacity and stores the checkout as HELD.
  hold(checkout: NewCheckout, now: Date): Promise<HoldResult>;
  findByIdempotencyKey(key: string): Promise<CheckoutPayment | null>;
  findByPaymentReference(reference: string): Promise<CheckoutPayment | null>;
  // Stores the payment attempt and moves the checkout to PAYMENT_PENDING.
  // If another attempt already opened a payment for this checkout, nothing
  // is stored and that payment is returned instead.
  attachPayment(
    checkoutId: string,
    payment: {
      reference: string;
      provider: string;
      accessCode: string | null;
      authorizationUrl: string;
      amountMinor: number;
      currency: string;
    },
  ): Promise<{ reference: string; authorizationUrl: string }>;
  // A payment that won't complete: the checkout fails unless already paid.
  recordFailure(
    reference: string,
    status: "FAILED" | "ABANDONED" | "REVERSED",
    payload: unknown,
  ): Promise<void>;
  markReview(checkoutId: string, reason: string): Promise<void>;
  // Idempotent: a paid checkout returns its existing order. A lapsed hold
  // takes its places again if they are still free; otherwise the checkout
  // needs review and nothing is oversold.
  settle(request: SettleRequest): Promise<SettleResult>;
  // Stores a webhook; returns its id, or null when it was already handled.
  recordEvent(event: PaymentEvent): Promise<string | null>;
  finishEvent(id: string, error: string | null): Promise<void>;
  // The viewer's account orders plus guest orders made in this browser.
  listOrders(viewer: Viewer): Promise<OrderView[]>;
  // The reference of the order that paid for each trip, newest first wins.
  ordersForTrips(tripIds: string[]): Promise<Map<string, string>>;
  findOrder(viewer: Viewer, reference: string): Promise<OrderView | null>;
  // Unscoped: only for the receipt email and a verified emailed link.
  findOrderByReference(reference: string): Promise<OrderView | null>;
}
