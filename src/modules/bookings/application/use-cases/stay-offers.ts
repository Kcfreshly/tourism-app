import { AppError } from "@/shared/application/app-error";
import { holdMinutes, priceVersion } from "../../domain/checkout";
import {
  maxOpenStayOffers,
  nights,
  stayOpen,
  type SendStayOffer,
} from "../../domain/stay-offer";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { Notifier } from "../ports/notifier";
import type { StayOfferRepository } from "../ports/stay-offer-repository";
import type {
  PaymentStarter,
  StartedCheckout,
} from "../services/payment-starter";

// Staff: paid trips and the stays offered for them.
export class ListStayOrders {
  constructor(private readonly stays: StayOfferRepository) {}

  execute() {
    return this.stays.tripOrders();
  }
}

// Staff send a place to stay into a paid trip. Its price includes the
// markup. At most three can be open at once, and none once one is booked.
// The traveller is told it's ready to approve.
export class SendStayOfferToTrip {
  constructor(
    private readonly stays: StayOfferRepository,
    private readonly notifier: Pick<Notifier, "stayOffered">,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(actorId: string, input: SendStayOffer) {
    const now = this.clock();
    const order = await this.stays.orderByReference(input.orderReference);
    if (!order?.tripId)
      throw new AppError(
        "NOT_FOUND",
        "NOT_FOUND",
        "No paid trip has that order reference.",
      );
    const availableUntil = new Date(input.availableUntil);
    if (availableUntil <= now)
      throw new AppError(
        "INVALID",
        "OFFER_LAPSED",
        "Choose an “available until” time in the future.",
      );
    const state = await this.stays.state(order.orderId, now);
    if (state.booked)
      throw new AppError(
        "CONFLICT",
        "STAY_ALREADY_BOOKED",
        "This trip already has a booked stay.",
      );
    if (state.open >= maxOpenStayOffers)
      throw new AppError(
        "CONFLICT",
        "TOO_MANY_OFFERS",
        `A trip can have ${maxOpenStayOffers} open offers. Withdraw one first.`,
      );
    const offer = await this.stays.create(
      {
        id: crypto.randomUUID(),
        orderId: order.orderId,
        propertyName: input.propertyName,
        area: input.area,
        address: input.address,
        room: input.room,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        note: input.note,
        priceMinor: input.priceMinor,
        availableUntil,
      },
      actorId,
    );
    await this.notifier.stayOffered({
      orderReference: order.reference,
      offer,
    });
    return offer;
  }
}

export class WithdrawStayOffer {
  constructor(private readonly stays: StayOfferRepository) {}

  async execute(
    actorId: string,
    input: { id: string; expectedVersion: number },
  ) {
    const withdrawn = await this.stays.withdraw(
      input.id,
      input.expectedVersion,
      actorId,
    );
    if (!withdrawn)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This offer changed or was already taken. Reload the list.",
      );
    return withdrawn;
  }
}

// The traveller approves an offer and pays for it: a second payment on the
// trip's order, at the offered price, with no extra fee. One press per
// Idempotency-Key, like any Pay.
export class ApproveStay {
  constructor(
    private readonly stays: StayOfferRepository,
    private readonly checkouts: CheckoutRepository,
    private readonly payments: PaymentStarter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: {
    user: { id: string; email: string };
    offerId: string;
    idempotencyKey: string;
  }): Promise<StartedCheckout> {
    const now = this.clock();
    const earlier = await this.payments.resume(
      command.user,
      command.idempotencyKey,
      now,
    );
    if (earlier) return earlier;

    const found = await this.stays.find(command.offerId);
    if (!found || found.order.userId !== command.user.id)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Offer not found.");
    const { offer, order } = found;
    if ((await this.stays.state(order.orderId, now)).booked)
      throw new AppError(
        "CONFLICT",
        "STAY_ALREADY_BOOKED",
        "You’ve already booked a stay for this trip.",
      );
    if (!stayOpen(offer, now))
      throw new AppError(
        "CONFLICT",
        "OFFER_LAPSED",
        "This offer is no longer available. Ask Fastlife for another.",
      );

    const checkoutId = crypto.randomUUID();
    const n = nights(offer);
    const hold = await this.checkouts.hold(
      {
        id: checkoutId,
        userId: command.user.id,
        guestKeyHash: null,
        idempotencyKey: command.idempotencyKey,
        contact: { ...order.contact, email: command.user.email },
        subtotalMinor: offer.priceMinor,
        feeMinor: 0,
        totalMinor: offer.priceMinor,
        currency: "NGN",
        priceVersion,
        expiresAt: new Date(now.getTime() + holdMinutes * 60000),
        trip: null,
        orderId: order.orderId,
        lines: [
          {
            line: {
              kind: "STAY",
              id: offer.id,
              propertyName: offer.propertyName,
              room: offer.room,
              checkIn: offer.checkIn,
              checkOut: offer.checkOut,
            },
            title: offer.propertyName,
            rows: [
              {
                label: `${offer.room} · ${n} ${n === 1 ? "night" : "nights"}`,
                totalMinor: offer.priceMinor,
              },
            ],
            subtotalMinor: offer.priceMinor,
            feeMinor: 0,
            totalMinor: offer.priceMinor,
            terms: {
              operator: offer.propertyName,
              where: offer.address,
              confirmation: "INSTANT",
              partnerHours: 0,
              freeCancellationHours: null,
              cancellation:
                "Set by the property. Fastlife confirms the terms with you.",
            },
            slot: null,
          },
        ],
      },
      now,
    );
    if (!hold.held && "duplicateKey" in hold) {
      const first = await this.payments.resume(
        command.user,
        command.idempotencyKey,
        now,
      );
      if (first) return first;
      throw new AppError(
        "CONFLICT",
        "IDEMPOTENCY_KEY_REUSED",
        "Reload the page and press Pay again.",
      );
    }
    return this.payments.open(checkoutId, offer.priceMinor, command.user.email);
  }
}
