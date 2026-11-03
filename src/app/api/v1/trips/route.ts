import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
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
import { publishedSelection } from "@/server/selection";
import { limit } from "@/server/limits";
import { profileSchema } from "@/domain/profile";
export async function GET() {
  try {
    const actor = await identity();
    const data = await db()
      .select()
      .from(trips)
      .where(ownsTrip(actor))
      .orderBy(desc(trips.updatedAt));
    return success(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    await checkOrigin();
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        422,
        "INVALID_PROFILE",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    const actor = await identity();
    await limit(`trip-create:${actor.id}`, 20);
    // Drop bucket ideas that were unpublished since they were saved, rather
    // than refusing the whole draft.
    const profile = {
      ...parsed.data,
      selectedOfferIds: await publishedSelection(parsed.data.selectedOfferIds),
    };
    const [data] = await db()
      .insert(trips)
      .values({
        id: randomUUID(),
        ownerId: actor.id,
        ownerType: actor.kind,
        profile,
        items: [],
        services: {
          assistance: profile.assistance,
          vehicleWindows: {},
          guideItemIds: [],
          guideDays: [],
        },
      })
      .returning();
    return success(data, 201);
  } catch (e) {
    return failure(e);
  }
}
