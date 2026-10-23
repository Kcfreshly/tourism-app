import { z } from "zod";
import { validateSelection } from "@/server/selection";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { proposals } from "@/server/schema";
import { ownedTrip } from "@/server/trip-access";
import { listCatalogue } from "@/server/catalogue";
import { propose } from "@/server/planner";
import { checkOrigin, success, failure, ApiError } from "@/server/identity";
import { assess } from "@/domain/planner";
import { limit } from "@/server/limits";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkOrigin();
    const c = await ownedTrip((await params).id);
    await limit(`planner:${c.actor.id}`, 10);
    const offers = await listCatalogue();
    const input = z
      .object({
        selectedOfferIds: z.array(z.string().max(100)).max(30).optional(),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new ApiError(
        422,
        "INVALID_SELECTION",
        "Choose up to 30 saved experiences.",
      );
    if (input.data.selectedOfferIds)
      await validateSelection(input.data.selectedOfferIds);
    const profile = {
      ...c.profile,
      selectedOfferIds:
        input.data.selectedOfferIds ?? c.profile.selectedOfferIds,
    };
    const proposal = propose(profile, c.items, c.services, offers);
    const id = randomUUID();
    await db()
      .insert(proposals)
      .values({
        id,
        tripId: c.trip.id,
        tripVersion: c.trip.version,
        payload: proposal,
        expiresAt: new Date(Date.now() + 15 * 60000),
      });
    return success({
      id,
      expectedVersion: c.trip.version,
      ...proposal,
      price: assess(c.profile, proposal.items, proposal.services, offers),
      diff: {
        removed: c.items.filter(
          (i) => !proposal.items.some((p) => p.id === i.id),
        ),
        added: proposal.items.filter(
          (i) => !c.items.some((p) => p.id === i.id),
        ),
      },
    });
  } catch (e) {
    return failure(e);
  }
}
