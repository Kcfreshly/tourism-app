import type { CartLine, PriceRow } from "../../domain/cart";
import type {
  BookingStatus,
  CheckoutStatus,
  OrderView,
} from "../../domain/checkout";
import type { LineTerms, SlotRef } from "../../domain/resolve-line";

// A line ready to hold: priced, with its slot and booked terms.
export type HeldLine = {
  line: CartLine;
  title: string;
  rows: PriceRow[];
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  terms: LineTerms;
  slot: SlotRef;
};

export type NewCheckout = {
  id: string;
  userId: string;
  idempotencyKey: string;
  contact: { name: string; email: string; phone: string };
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  currency: string;
  priceVersion: string;
  expiresAt: Date;
  lines: HeldLine[];
};

export type HoldResult =
  { held: true } | { held: false; cartLineId: string; remaining: number };

export type CheckoutPayment = {
  checkout: {
    id: string;
    userId: string;
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
  // Decides each booking's starting status; runs inside the transaction.
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
  // In one transaction: lapses this traveller's other open holds, locks the
  // slots in id order, re-checks capacity and stores the checkout as HELD.
  hold(checkout: NewCheckout, now: Date): Promise<HoldResult>;
  findByIdempotencyKey(key: string): Promise<CheckoutPayment | null>;
  findByPaymentReference(reference: string): Promise<CheckoutPayment | null>;
  // Stores the payment attempt and moves the checkout to PAYMENT_PENDING.
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
  ): Promise<void>;
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
  listOrders(userId: string): Promise<OrderView[]>;
  findOrder(userId: string, reference: string): Promise<OrderView | null>;
}
