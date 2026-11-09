import type { TripChanges, TripOwner, TripRow } from "./trip-repository";

export type ApplyProposalResult =
  | { kind: "APPLIED"; trip: TripRow }
  | { kind: "STALE_PROPOSAL" }
  | { kind: "VERSION_CONFLICT" };

export interface ProposalRepository {
  save(proposal: {
    id: string;
    tripId: string;
    tripVersion: number;
    payload: unknown;
    expiresAt: Date;
  }): Promise<void>;
  // In one transaction: claims an unexpired, unapplied proposal made from
  // `expectedVersion`, runs `decide` on its payload and writes the result to
  // the trip. If `decide` throws or the trip version moved on, the claim is
  // rolled back.
  apply(
    input: {
      proposalId: string;
      tripId: string;
      owner: TripOwner;
      expectedVersion: number;
    },
    decide: (payload: unknown) => TripChanges,
  ): Promise<ApplyProposalResult>;
}
