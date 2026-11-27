import type { PartnerBookingView } from "../../domain/partner-booking";
import type { StayView } from "../../domain/stay-offer";
import type { ServiceKind, ServiceStatus } from "../../domain/trip-checkout";

// Tells travellers and staff what happened. The paid-order receipt, partner
// decisions, driver/guide matches and stay offers are emailed
// (ReceiptNotifier); the rest only log.
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
    id: string;
    userId: string;
    orderReference: string;
    service: ServiceKind;
    status: ServiceStatus;
    assignee: Record<string, string> | null;
  }): Promise<void>;
  // A partner confirmed or declined a booking, or its deadline passed.
  bookingDecided(event: PartnerBookingView): Promise<void>;
  // Staff sent a place to stay for the traveller to approve and pay.
  stayOffered(event: {
    orderReference: string;
    offer: StayView;
  }): Promise<void>;
}
