import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { trips } from "@/server/schema";
import { ownedTrip } from "@/server/trip-access";
import { listCatalogue } from "@/server/catalogue";
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
import { limit } from "@/server/limits";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const context = await ownedTrip((await params).id),
      offers = await listCatalogue();
    return success({
      trip: context.trip,
      offers,
      price: assess(context.profile, context.items, context.services, offers),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    await checkOrigin();
    const c = await ownedTrip((await params).id);
    await limit(`trip-write:${c.actor.id}`, 100);
    const input = z
      .object({
        expectedVersion: z.number().int().positive(),
        items: z.array(itemSchema).max(240),
        services: servicesSchema,
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new ApiError(
        422,
        "INVALID_SCHEDULE",
        "Check schedule dates, times and service windows.",
      );
    const { items, services, expectedVersion } = input.data;
    const offers = await listCatalogue();
    const issue = placementIssues(c.profile, items, services, offers)[0];
    if (issue) throw new ApiError(422, issue.code, placementMessage(issue));
    const price = assess(c.profile, items, services, offers);
    const [trip] = await db()
      .update(trips)
      .set({
        items,
        services,
        profile: { ...c.profile, assistance: services.assistance },
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trips.id, c.trip.id),
          ownsTrip(c.actor),
          eq(trips.version, expectedVersion),
        ),
      )
      .returning();
    if (!trip)
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "Draft changed in another tab. Your edits are retained; reload the latest saved plan.",
      );
    return success({ trip, price });
  } catch (e) {
    return failure(e);
  }
}
