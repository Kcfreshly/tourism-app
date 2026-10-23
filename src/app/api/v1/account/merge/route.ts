import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, trips, audit } from "@/server/schema";
import {
  accountIdentity,
  guestIdentity,
  checkOrigin,
  ApiError,
  failure,
  success,
} from "@/server/identity";
import { randomUUID } from "node:crypto";
export async function POST() {
  try {
    await checkOrigin();
    const actor = await accountIdentity();
    if (!actor)
      throw new ApiError(
        401,
        "SIGN_IN_REQUIRED",
        "Sign in before linking drafts.",
      );
    const guest = await guestIdentity().catch((e) => {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    });
    if (!guest) return success({ merged: 0 });
    const count = await db().transaction(async (tx) => {
      const [claimed] = await tx
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(
          and(eq(sessions.id, guest.id), gt(sessions.expiresAt, new Date())),
        )
        .returning();
      if (!claimed) return 0;
      const moved = await tx
        .update(trips)
        .set({ ownerId: actor.id, ownerType: "ACCOUNT" })
        .where(and(eq(trips.ownerId, guest.id), eq(trips.ownerType, "GUEST")))
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: actor.id,
        action: "GUEST_DRAFTS_MERGED",
        entityId: guest.id,
        details: { tripIds: moved.map((t) => t.id) },
      });
      return moved.length;
    });
    (await cookies()).delete("tourism-session");
    return success({ merged: count });
  } catch (e) {
    return failure(e);
  }
}
