import type { PartnerBookingView } from "../../domain/partner-booking";
import type { ServiceKind, ServiceStatus } from "../../domain/trip-checkout";

// Tells travellers and staff what happened. The paid-order receipt and
// partner decisions are emailed (ReceiptNotifier); the rest only log for now.
// A guest order has no userId, so email goes to the checkout email.
export interface Notifier {
  orderPaid(event: {
    userId: string | null;
    email: string;
    orderReference: string;
  }): Promise<void>;
  needsReview(event: { checkoutId: string; reason: string }): Promise<void>;
  // A car or guide moved on: matched, refund due or completed.
  serviceUpdated(event: {
    userId: string;
    orderReference: string;
    service: ServiceKind;
    status: ServiceStatus;
    assignee: Record<string, string> | null;
  }): Promise<void>;
  // A partner confirmed or declined a booking, or its deadline passed.
  bookingDecided(event: PartnerBookingView): Promise<void>;
}
