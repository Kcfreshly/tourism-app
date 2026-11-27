import type { StayView } from "../../domain/stay-offer";
import type { TripArrangements } from "../../domain/checkout";

// A paid trip as staff see it when sending stay offers.
export type StayTripOrder = {
  orderId: string;
  reference: string;
  tripId: string | null;
  paidAt: string;
  contact: { name: string; phone: string; email: string };
  // First and last day of the trip's bookings and services.
  from: string;
  to: string;
  offers: StayView[];
  // What the traveller asked for, when Fastlife books their stay, and when
  // we promised to reply by.
  request?: TripArrangements;
  respondBy?: string;
};

// The order an offer belongs to, and who may approve it.
export type StayOrder = {
  orderId: string;
  reference: string;
  tripId: string | null;
  userId: string | null;
  contact: { name: string; phone: string; email: string };
};

export type NewStayOffer = {
  id: string;
  orderId: string;
  propertyName: string;
  area: string;
  address: string;
  room: string;
  checkIn: string;
  checkOut: string;
  note: string;
  priceMinor: number;
  availableUntil: Date;
};

export interface StayOfferRepository {
  // Paid trips, soonest first, with their offers.
  tripOrders(): Promise<StayTripOrder[]>;
  orderByReference(reference: string): Promise<StayOrder | null>;
  // The offer and its order.
  find(id: string): Promise<{ offer: StayView; order: StayOrder } | null>;
  // Offers on the order that the traveller could still approve, and
  // whether one is booked.
  state(orderId: string, now: Date): Promise<{ open: number; booked: boolean }>;
  // Each writes an audit event in the same transaction.
  create(offer: NewStayOffer, actorId: string): Promise<StayView>;
  // Only an offer still OFFERED, at that version; null otherwise.
  withdraw(
    id: string,
    expectedVersion: number,
    actorId: string,
  ): Promise<StayView | null>;
}
