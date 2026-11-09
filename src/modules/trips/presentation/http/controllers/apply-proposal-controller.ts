import { AppError } from "@/shared/application/app-error";
import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { ApplyProposal } from "../../../application/use-cases/apply-proposal";
import type { OwnedTripLoader } from "../owned-trip";
import { applyProposalRequest } from "../schemas/trip-requests";

export function createApplyProposalController(
  guards: RequestGuards,
  ownedTrip: OwnedTripLoader,
  applyProposal: ApplyProposal,
) {
  return controller(async (request: Request, { params }: IdParams) => {
    await guards.checkOrigin();
    const trip = await ownedTrip((await params).id);
    const input = applyProposalRequest.safeParse(await request.json());
    if (!input.success)
      throw new AppError(
        "INVALID",
        "INVALID_PROPOSAL",
        "Choose a valid proposal.",
      );
    return success(await applyProposal.execute(trip, input.data));
  });
}
