import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import {
  assess,
  itemSchema,
  placementIssues,
  placementMessage,
  servicesSchema,
} from "../../domain/planner";
import {
  assertPlannerContract,
  lockedItemsUnchanged,
} from "../../domain/proposal";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { ProposalRepository } from "../ports/proposal-repository";
import type { TripContext } from "./load-owned-trip";

const payloadSchema = z
  .object({ items: z.array(itemSchema).max(240), services: servicesSchema })
  .passthrough();

// Applies a previewed proposal once, only if locked items are untouched and
// the result still fits the trip.
export class ApplyProposal {
  constructor(
    private readonly proposals: ProposalRepository,
    private readonly offers: OfferCatalogue,
  ) {}

  async execute(
    context: TripContext,
    input: { proposalId: string; expectedVersion: number },
  ) {
    const offers = await this.offers.listPublished();
    let applied: z.infer<typeof payloadSchema> | undefined;
    const result = await this.proposals.apply(
      {
        proposalId: input.proposalId,
        tripId: context.trip.id,
        owner: context.actor,
        expectedVersion: input.expectedVersion,
      },
      (stored) => {
        const payload = payloadSchema.parse(stored);
        if (!lockedItemsUnchanged(context.items, payload.items))
          throw new AppError(
            "CONFLICT",
            "LOCK_CHANGED",
            "A locked item changed. Regenerate the proposal.",
          );
        assertPlannerContract(payload.items);
        const issue = placementIssues(
          context.profile,
          payload.items,
          payload.services,
          offers,
        )[0];
        if (issue)
          throw new AppError("INVALID", issue.code, placementMessage(issue));
        applied = payload;
        return {
          items: payload.items,
          services: payload.services,
          profile: {
            ...context.profile,
            assistance: payload.services.assistance,
          },
        };
      },
    );
    if (result.kind === "STALE_PROPOSAL")
      throw new AppError(
        "CONFLICT",
        "STALE_PROPOSAL",
        "This proposal expired or has already been applied. Generate a new preview.",
      );
    if (result.kind === "VERSION_CONFLICT" || !applied)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "The plan changed. Preview a new proposal.",
      );
    return {
      trip: result.trip,
      price: assess(context.profile, applied.items, applied.services, offers),
    };
  }
}
