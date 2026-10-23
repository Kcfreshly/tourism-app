import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions } from "@/server/schema";
import {
  checkOrigin,
  failure,
  identity,
  guestIdentity,
  ApiError,
  success,
} from "@/server/identity";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
export async function DELETE() {
  try {
    await checkOrigin();
    const actor = await identity();
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
    if (actor.kind === "ACCOUNT")
      return auth().handler(
        new Request(
          new URL(
            "/api/auth/sign-out",
            process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
          ),
          { method: "POST", headers: await headers(), body: "{}" },
        ),
      );
    await db()
      .update(sessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(sessions.id, actor.id));
    (await cookies()).delete("tourism-session");
    return success({ signedOut: true });
  } catch (e) {
    return failure(e);
  }
}
