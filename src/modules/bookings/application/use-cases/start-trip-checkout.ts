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
