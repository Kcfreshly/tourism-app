import type { BookingStatus } from "../../domain/checkout";
import type { PartnerBookingView } from "../../domain/partner-booking";

export type BookingChange = {
  id: string;
  expectedVersion: number;
  status: BookingStatus;
  actorType: "PARTNER" | "STAFF";
  actorId: string;
  reason: string | null;
};

export interface PartnerBookingRepository {
  // A partner's bookings: waiting ones first, then upcoming, then recent.
  listForPartner(partnerId: string): Promise<PartnerBookingView[]>;
  // Staff: every booking still waiting for a partner, and refunds due.
  listForStaff(): Promise<PartnerBookingView[]>;
  find(id: string): Promise<PartnerBookingView | null>;
  // Writes the change, a status history row and an audit event in one
  // transaction. Null when the version no longer matches.
  decide(change: BookingChange): Promise<PartnerBookingView | null>;
  // Waiting bookings past their deadline become DECLINED. Returns them.
  expireOverdue(now: Date): Promise<PartnerBookingView[]>;
}
