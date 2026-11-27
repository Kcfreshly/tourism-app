import type { AirportPickup } from "../../../trips/domain/profile";
import type { ServiceKind, ServiceStatus } from "../../domain/trip-checkout";

// A paid car or guide as staff see it in the matching queue.
export type QueuedService = {
  id: string;
  version: number;
  userId: string;
  tripId: string | null;
  orderReference: string;
  service: ServiceKind;
  date: string;
  startTime: string;
  label: string;
  status: ServiceStatus;
  matchBy: string;
  assignee: Record<string, string> | null;
  contact: { name: string; phone: string };
  totalMinor: number;
  // An airport pickup's flight, read from the trip as it is now.
  arrival?: AirportPickup;
};

export type ServiceChange = {
  id: string;
  expectedVersion: number;
  status: ServiceStatus;
  // Null keeps the current one.
  assignee: Record<string, string> | null;
  actorType: "STAFF" | "SYSTEM";
  actorId: string;
  note: string | null;
};

export interface ServiceRequestRepository {
  // Waiting, matched and refund-due requests, soonest service first.
  listQueue(): Promise<QueuedService[]>;
  find(id: string): Promise<QueuedService | null>;
  // Writes the change, its history row and an audit event in one
  // transaction. Null when the version no longer matches.
  update(change: ServiceChange): Promise<QueuedService | null>;
  // Requests still waiting at their deadline become UNMATCHED (refund due).
  // Returns the ones changed.
  expireOverdue(now: Date): Promise<QueuedService[]>;
}
