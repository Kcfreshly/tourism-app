import type { ServiceKind, ServiceStatus } from "../../domain/trip-checkout";

// Tells travellers and staff what happened. Phase 1 only logs (D8); email
// or WhatsApp plug in here later.
export interface Notifier {
  orderPaid(event: { userId: string; orderReference: string }): Promise<void>;
  needsReview(event: { checkoutId: string; reason: string }): Promise<void>;
  // A car or guide moved on: matched, refund due or completed.
  serviceUpdated(event: {
    userId: string;
    orderReference: string;
    service: ServiceKind;
    status: ServiceStatus;
    assignee: Record<string, string> | null;
  }): Promise<void>;
}
