import { AppError } from "@/shared/application/app-error";
import {
  nextBookingStatus,
  type BookingDecision,
  type PartnerBookingView,
} from "../../domain/partner-booking";
import type { Notifier } from "../ports/notifier";
import type { PartnerBookingRepository } from "../ports/partner-booking-repository";

// Bookings nobody confirmed by their deadline are declined, so the traveller
// is refunded and the places go back on sale. There is no scheduled job yet
// (D7): the partner's and staff's lists and the traveller's pages run this
// before they read.
export class ExpireUnconfirmedBookings {
  constructor(
    private readonly bookings: PartnerBookingRepository,
    private readonly notifier: Notifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute() {
    const expired = await this.bookings.expireOverdue(this.clock());
    for (const b of expired) await this.notifier.bookingDecided(b);
    return expired.length;
  }
}

export class ListPartnerBookings {
  constructor(
    private readonly bookings: PartnerBookingRepository,
    private readonly expire: ExpireUnconfirmedBookings,
  ) {}

  async forPartner(partnerId: string) {
    await this.expire.execute();
    return this.bookings.listForPartner(partnerId);
  }

  async forStaff() {
    await this.expire.execute();
    return this.bookings.listForStaff();
  }
}

// The partner (or staff on their behalf, for example after a phone call)
// confirms or declines a waiting booking. The traveller is told either way.
export class DecideBooking {
  constructor(
    private readonly bookings: PartnerBookingRepository,
    private readonly notifier: Notifier,
    private readonly expire: ExpireUnconfirmedBookings,
  ) {}

  async execute(
    actor:
      | { type: "PARTNER"; id: string; partnerId: string }
      | { type: "STAFF"; id: string },
    decision: BookingDecision,
  ): Promise<PartnerBookingView> {
    // A booking past its deadline is declined first, not confirmed late.
    await this.expire.execute();
    const current = await this.bookings.find(decision.id);
    // A partner only ever sees its own bookings.
    if (
      !current ||
      (actor.type === "PARTNER" && current.partnerId !== actor.partnerId)
    )
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Booking not found.");
    const status = nextBookingStatus(current.status, decision.action);
    if (!status)
      throw new AppError(
        "CONFLICT",
        "INVALID_TRANSITION",
        current.status === "CONFIRMED"
          ? "This booking is already confirmed."
          : current.status === "DECLINED"
            ? "This booking was already declined; the traveller is due a refund."
            : "This booking can’t change that way any more.",
      );
    const updated = await this.bookings.decide({
      id: decision.id,
      expectedVersion: decision.expectedVersion,
      status,
      actorType: actor.type,
      actorId: actor.id,
      reason: decision.action === "DECLINE" ? decision.reason : null,
    });
    if (!updated)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This booking changed meanwhile. Reload and try again.",
      );
    await this.notifier.bookingDecided(updated);
    return updated;
  }
}
