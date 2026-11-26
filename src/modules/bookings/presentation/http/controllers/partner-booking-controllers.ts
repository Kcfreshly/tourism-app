import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { bookingDecisionSchema } from "../../../domain/partner-booking";
import type {
  DecideBooking,
  ListPartnerBookings,
} from "../../../application/use-cases/partner-bookings";

function decision(body: unknown) {
  const input = bookingDecisionSchema.safeParse(body);
  if (!input.success)
    throw new AppError(
      "INVALID",
      "INVALID_BOOKING_DECISION",
      input.error.issues[0]?.message ?? "Check the details and try again.",
    );
  return input.data;
}

// GET / PATCH /partner/bookings: a verified partner's bookings, confirmed or
// declined by them. GET / PATCH /admin/partner-bookings: staff see every
// booking waiting for a partner and can decide on the partner's behalf.
export function createPartnerBookingControllers(deps: {
  guards: RequestGuards;
  // The caller's verified partner; throws when there isn't one.
  verifiedPartner: (userId: string) => Promise<{ id: string }>;
  list: ListPartnerBookings;
  decide: DecideBooking;
}) {
  const { guards } = deps;
  return {
    partnerList: controller(async () => {
      const actor = await guards.requireActor();
      const partner = await deps.verifiedPartner(actor.id);
      return success(await deps.list.forPartner(partner.id));
    }),
    partnerDecide: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireActor();
      const partner = await deps.verifiedPartner(actor.id);
      await guards.throttle(`booking-decide:${actor.id}`, 60);
      return success(
        await deps.decide.execute(
          { type: "PARTNER", id: actor.id, partnerId: partner.id },
          decision(await request.json()),
        ),
      );
    }),
    staffList: controller(async () => {
      await guards.requireAdmin();
      return success(await deps.list.forStaff());
    }),
    staffDecide: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`booking-decide:${actor.id}`, 60);
      return success(
        await deps.decide.execute(
          { type: "STAFF", id: actor.id },
          decision(await request.json()),
        ),
      );
    }),
  };
}
