import { randomUUID } from "node:crypto";
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
import { profileSchema } from "@/domain/profile";
export async function GET() {
  try {
    const actor = await identity();
    const data = await db().select().from(trips).where(ownsTrip(actor));
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
    const actor = await identity(true);
    await limit(`trip-create:${actor.id}`, 20);
    await validateSelection(parsed.data.selectedOfferIds);
    const [data] = await db()
      .insert(trips)
      .values({
        id: randomUUID(),
        ownerId: actor.id,
        ownerType: actor.kind,
        profile: parsed.data,
        items: [],
        services: {
          assistance: parsed.data.assistance,
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
