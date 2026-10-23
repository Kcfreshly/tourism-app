import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { trips } from "./schema";
import { identity, ownsTrip, ApiError } from "./identity";
import { profileSchema } from "../domain/profile";
import { itemSchema, servicesSchema } from "../domain/planner";
export async function ownedTrip(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "NOT_FOUND", "Trip not found.");
  const actor = await identity();
  const [trip] = await db()
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), ownsTrip(actor)));
  if (!trip) throw new ApiError(404, "NOT_FOUND", "Trip not found.");
  return {
    actor,
    trip,
    profile: profileSchema.parse(trip.profile),
    items: z.array(itemSchema).parse(trip.items),
    services: servicesSchema.parse(trip.services),
  };
}
