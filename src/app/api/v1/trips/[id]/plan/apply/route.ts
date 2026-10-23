import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { trips, proposals } from "@/server/schema";
import { ownedTrip } from "@/server/trip-access";
import { listCatalogue } from "@/server/catalogue";
import { lockedItemsUnchanged, assertPlannerContract } from "@/server/planner";
import {
  checkOrigin,
  success,
  failure,
  ownsTrip,
  ApiError,
} from "@/server/identity";
import {
  itemSchema,
  servicesSchema,
  assess,
  placementIssues,
  placementMessage,
} from "@/domain/planner";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkOrigin();
    const c = await ownedTrip((await params).id);
    const input = z
      .object({
        proposalId: z.uuid(),
        expectedVersion: z.number().int().positive(),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new ApiError(422, "INVALID_PROPOSAL", "Choose a valid proposal.");
    const offers = await listCatalogue();
    const result = await db().transaction(async (tx) => {
      const [proposal] = await tx
        .update(proposals)
        .set({ appliedAt: new Date() })
        .where(
          and(
            eq(proposals.id, input.data.proposalId),
            eq(proposals.tripId, c.trip.id),
            eq(proposals.tripVersion, input.data.expectedVersion),
            gt(proposals.expiresAt, new Date()),
            isNull(proposals.appliedAt),
          ),
        )
        .returning();
      if (!proposal)
        throw new ApiError(
          409,
          "STALE_PROPOSAL",
          "This proposal expired or has already been applied. Generate a new preview.",
        );
      const payload = z
        .object({
          items: z.array(itemSchema).max(240),
          services: servicesSchema,
        })
        .passthrough()
        .parse(proposal.payload);
      if (!lockedItemsUnchanged(c.items, payload.items))
        throw new ApiError(
          409,
          "LOCK_CHANGED",
          "A locked item changed. Regenerate the proposal.",
        );
      assertPlannerContract(payload.items);
      const issue = placementIssues(
        c.profile,
        payload.items,
        payload.services,
        offers,
      )[0];
      if (issue) throw new ApiError(422, issue.code, placementMessage(issue));
      const [trip] = await tx
        .update(trips)
        .set({
          items: payload.items,
          services: payload.services,
          profile: { ...c.profile, assistance: payload.services.assistance },
          version: input.data.expectedVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trips.id, c.trip.id),
            ownsTrip(c.actor),
            eq(trips.version, input.data.expectedVersion),
          ),
        )
        .returning();
      if (!trip)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "The plan changed. Preview a new proposal.",
        );
      return {
        trip,
        price: assess(c.profile, payload.items, payload.services, offers),
      };
    });
    return success(result);
  } catch (e) {
    return failure(e);
  }
}
