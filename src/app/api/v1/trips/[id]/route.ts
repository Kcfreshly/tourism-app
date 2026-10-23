import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { trips } from "@/server/schema";
import {
  checkOrigin,
  failure,
  identity,
  ApiError,
  ownsTrip,
  success,
} from "@/server/identity";
import { validateSelection } from "@/server/selection";
import { limit } from "@/server/limits";
import {
  itemSchema,
  placementIssues,
  placementMessage,
  servicesSchema,
} from "@/domain/planner";
import { listCatalogue } from "@/server/catalogue";
import { profileSchema } from "@/domain/profile";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "Draft not found.");
    const actor = await identity();
    const [data] = await db()
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), ownsTrip(actor)));
    if (!data) throw new ApiError(404, "NOT_FOUND", "Draft not found.");
    return success(data);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    await checkOrigin();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "Draft not found.");
    const actor = await identity();
    await limit(`trip-write:${actor.id}`, 100);
    const body = z
      .object({
        expectedVersion: z.number().int().positive(),
        profile: profileSchema,
      })
      .strict()
      .safeParse(await request.json());
    if (!body.success)
      throw new ApiError(
        422,
        "INVALID_PROFILE",
        "Check dates, interests and party size.",
      );
    const [existing] = await db()
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), ownsTrip(actor)));
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Draft not found.");
    await validateSelection(
      body.data.profile.selectedOfferIds,
      profileSchema.parse(existing.profile).selectedOfferIds,
    );
    const issue = placementIssues(
      body.data.profile,
      z.array(itemSchema).parse(existing.items),
      servicesSchema.parse(existing.services),
      await listCatalogue(),
    )[0];
    if (issue)
      throw new ApiError(
        422,
        issue.code,
        `This profile would invalidate your plan. ${placementMessage(issue)}`,
      );
    const [data] = await db()
      .update(trips)
      .set({
        profile: body.data.profile,
        services: {
          ...servicesSchema.parse(existing.services),
          assistance: body.data.profile.assistance,
        },
        version: body.data.expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trips.id, id),
          ownsTrip(actor),
          eq(trips.version, body.data.expectedVersion),
        ),
      )
      .returning();
    if (!data)
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "This draft changed in another tab. Copy your edits, then reload the saved draft.",
      );
    return success(data);
  } catch (e) {
    return failure(e);
  }
}
