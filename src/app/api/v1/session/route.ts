import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions } from "@/server/schema";
import {
  checkOrigin,
  failure,
  accountIdentity,
  guestIdentity,
  ApiError,
  success,
} from "@/server/identity";
import { auth } from "@/server/auth";
export async function DELETE() {
  try {
    await checkOrigin();
    const guest = await guestIdentity().catch((e) => {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    });
    if (guest)
      await db()
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, guest.id));
    (await cookies()).delete("tourism-session");
    if (await accountIdentity())
      await auth().api.signOut({ headers: await headers() });
    return success({ signedOut: true });
  } catch (e) {
    return failure(e);
  }
}
