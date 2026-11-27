import { randomUUID } from "node:crypto";
import { assess } from "../../domain/planner";
import { propose } from "../services/proposal";
import type { OfferCatalogue } from "../ports/offer-catalogue";
import type { ProposalRepository } from "../ports/proposal-repository";
import type { OfferSelection } from "../services/offer-selection";
import type { TransportSettingsRepository } from "../ports/transport-settings-repository";
import type { TripContext } from "./load-owned-trip";
import { assertNotBooked } from "../services/booked-trip";

// Proposals are previews: they are stored for 15 minutes and change nothing
// until applied.
const lifetimeMs = 15 * 60000;

export class GenerateProposal {
  constructor(
    private readonly proposals: ProposalRepository,
    private readonly offers: OfferCatalogue,
    private readonly selection: OfferSelection,
    private readonly transport: TransportSettingsRepository,
  ) {}

  async execute(context: TripContext, selectedOfferIds?: string[]) {
    assertNotBooked(context);
    const offers = await this.offers.listPublished();
    if (selectedOfferIds) await this.selection.validate(selectedOfferIds);
    const profile = {
      ...context.profile,
      selectedOfferIds: selectedOfferIds ?? context.profile.selectedOfferIds,
    };
    const { settings } = await this.transport.get();
    const proposal = propose(
      profile,
      context.items,
      context.services,
      offers,
      settings,
    );
    const id = randomUUID();
    await this.proposals.save({
      id,
      tripId: context.trip.id,
      tripVersion: context.trip.version,
      payload: proposal,
      expiresAt: new Date(Date.now() + lifetimeMs),
    });
    return {
      id,
      expectedVersion: context.trip.version,
      ...proposal,
      price: assess(
        context.profile,
        proposal.items,
        proposal.services,
        offers,
        undefined,
        settings,
      ),
      diff: {
        removed: context.items.filter(
          (i) => !proposal.items.some((p) => p.id === i.id),
        ),
        added: proposal.items.filter(
          (i) => !context.items.some((p) => p.id === i.id),
        ),
      },
    };
  }
}
