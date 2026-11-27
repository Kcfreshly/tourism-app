import { AppError } from "@/shared/application/app-error";
import {
  holdMinutes,
  priceVersion,
  type StartTripCheckoutInput,
} from "../../domain/checkout";
import { shareFee, tripCheckoutLines } from "../../domain/trip-checkout";
import type { BookableCatalogue } from "../ports/bookable-catalogue";
import type { CheckoutRepository } from "../ports/checkout-repository";
import type { TripSource } from "../ports/trip-source";
import type {
  PaymentStarter,
  StartedCheckout,
} from "../services/payment-starter";

// Pay pressed on a planned trip: one payment for its activities, cars and
// guides, at the planner's price. Activities hold places; cars and guides
// are matched by staff after payment.
export class StartTripCheckout {
  constructor(
    private readonly trips: TripSource,
    private readonly catalogue: BookableCatalogue,
    private readonly checkouts: CheckoutRepository,
    private readonly payments: PaymentStarter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: {
    user: { id: string; email: string };
    tripId: string;
    idempotencyKey: string;
    input: StartTripCheckoutInput;
  }): Promise<StartedCheckout> {
    const now = this.clock();
    const earlier = await this.payments.resume(
      command.user,
      command.idempotencyKey,
      now,
    );
    if (earlier) return earlier;

    const trip = await this.trips.load(command.user.id, command.tripId);
    // Paid already (another tab, or Pay pressed again after paying): show
    // that order rather than charging twice.
    if (trip.orderReference)
      return { status: "PAID", orderReference: trip.orderReference };
    if (trip.version !== command.input.expectedVersion)
      throw new AppError(
        "CONFLICT",
        "TRIP_CHANGED",
        "Your trip changed since you opened checkout. Check it and press Pay again.",
      );
    if (trip.blockers.length)
      throw new AppError(
        "CONFLICT",
        "TRIP_NOT_READY",
        "Sort out the items listed above before paying.",
      );
    if (!trip.price.lines.some((l) => l.group === "activities"))
      throw new AppError(
        "CONFLICT",
        "TRIP_NOT_READY",
        "Add at least one activity to your trip.",
      );
    if (trip.price.totalMinor !== command.input.shownTotalMinor)
      throw new AppError(
        "CONFLICT",
        "PRICE_CHANGED",
        "The price changed since you opened checkout. Check the new total.",
        { totalMinor: trip.price.totalMinor },
      );

    const { lines, problems } = tripCheckoutLines(
      trip,
      await this.catalogue.load(),
      now.getTime(),
    );
    // The address may be added after booking, but not once a driver needs
    // it to be matched and briefed.
    if (
      trip.pickupOverdue &&
      lines.some(
        (l) =>
          l.line.kind === "SERVICE" &&
          (l.line.service === "CAR" || l.line.service === "NIGHT_CAR"),
      )
    )
      problems.push(
        "Add your pickup address first: your driver needs it to be matched.",
      );
    if (
      trip.flightOverdue &&
      lines.some(
        (l) => l.line.kind === "SERVICE" && l.line.service === "AIRPORT_PICKUP",
      )
    )
      problems.push(
        "Add your flight number and landing time first: your driver needs them to meet you.",
      );
    if (problems.length)
      throw new AppError("CONFLICT", "TRIP_NOT_READY", problems.join(" "), {
        problems,
      });
    const fees = shareFee(
      lines.map((l) => l.subtotalMinor),
      trip.price.feeMinor,
    );

    const checkoutId = crypto.randomUUID();
    const hold = await this.checkouts.hold(
      {
        id: checkoutId,
        userId: command.user.id,
        guestKeyHash: null,
        idempotencyKey: command.idempotencyKey,
        contact: { ...command.input.contact, email: command.user.email },
        subtotalMinor: trip.price.subtotalMinor,
        feeMinor: trip.price.feeMinor,
        totalMinor: trip.price.totalMinor,
        currency: "NGN",
        priceVersion,
        expiresAt: new Date(now.getTime() + holdMinutes * 60000),
        trip: { id: trip.id, version: trip.version },
        lines: lines.map((l, i) => ({
          ...l,
          feeMinor: fees[i],
          totalMinor: l.subtotalMinor + fees[i],
        })),
      },
      now,
    );
    if (!hold.held && "duplicateKey" in hold) {
      // Double press reaching the server at once: the other request won.
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
    if (!hold.held) {
      const line = lines.find((l) => l.line.id === hold.cartLineId);
      throw new AppError(
        "CONFLICT",
        "CAPACITY_UNAVAILABLE",
        `${line?.title ?? "An activity"} just sold out at that time. Change it in the planner and press Pay again.`,
        { itemId: hold.cartLineId, remaining: hold.remaining },
      );
    }
    return this.payments.open(
      checkoutId,
      trip.price.totalMinor,
      command.user.email,
    );
  }
}
