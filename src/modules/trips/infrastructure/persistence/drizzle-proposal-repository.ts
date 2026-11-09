import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/database/client";
import type {
  ApplyProposalResult,
  ProposalRepository,
} from "../../application/ports/proposal-repository";
import type {
  TripChanges,
  TripOwner,
} from "../../application/ports/trip-repository";
import { proposals } from "./schema";
import { versionedTripUpdate } from "./drizzle-trip-repository";

// Thrown inside the transaction so the proposal claim rolls back with it.
class VersionMoved extends Error {}

export class DrizzleProposalRepository implements ProposalRepository {
  constructor(private readonly db: () => Database) {}

  async save(proposal: Parameters<ProposalRepository["save"]>[0]) {
    await this.db().insert(proposals).values(proposal);
  }

  async apply(
    input: {
      proposalId: string;
      tripId: string;
      owner: TripOwner;
      expectedVersion: number;
    },
    decide: (payload: unknown) => TripChanges,
  ): Promise<ApplyProposalResult> {
    try {
      return await this.db().transaction(async (tx) => {
        const [proposal] = await tx
          .update(proposals)
          .set({ appliedAt: new Date() })
          .where(
            and(
              eq(proposals.id, input.proposalId),
              eq(proposals.tripId, input.tripId),
              eq(proposals.tripVersion, input.expectedVersion),
              gt(proposals.expiresAt, new Date()),
              isNull(proposals.appliedAt),
            ),
          )
          .returning();
        if (!proposal) return { kind: "STALE_PROPOSAL" as const };
        const [trip] = await versionedTripUpdate(
          tx,
          input.tripId,
          input.owner,
          input.expectedVersion,
          decide(proposal.payload),
        );
        if (!trip) throw new VersionMoved();
        return { kind: "APPLIED" as const, trip };
      });
    } catch (e) {
      if (e instanceof VersionMoved) return { kind: "VERSION_CONFLICT" };
      throw e;
    }
  }
}
