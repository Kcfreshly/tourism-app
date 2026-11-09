import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { GenerateProposal } from "../../../application/use-cases/generate-proposal";
import type { OwnedTripLoader } from "../owned-trip";
import { generateProposalRequest } from "../schemas/trip-requests";

export function createGenerateProposalController(
  guards: RequestGuards,
  ownedTrip: OwnedTripLoader,
  generateProposal: GenerateProposal,
) {
  return controller(async (request: Request, { params }: IdParams) => {
    await guards.checkOrigin();
    const trip = await ownedTrip((await params).id);
    await guards.throttle(`planner:${trip.actor.id}`, 10);
    const input = generateProposalRequest.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_SELECTION",
        "Choose up to 30 saved experiences.",
      );
    return success(
      await generateProposal.execute(trip, input.data.selectedOfferIds),
    );
  });
}
