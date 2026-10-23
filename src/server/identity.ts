import { cookies, headers } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, trips, user } from "./schema";
import { auth } from "./auth";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function identity(create = false) {
  const account = await accountIdentity();
  if (account) return account;
  const guest = await guestIdentity(create);
  return { ...guest, kind: "GUEST" as const };
}
export async function accountIdentity() {
  const account = await auth().api.getSession({ headers: await headers() });
  if (!account) return null;
  const [record] = await db()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, account.user.id));
  return record ? { ...record, kind: "ACCOUNT" as const } : null;
}
export async function guestIdentity(create = false) {
  const jar = await cookies();
  const token = jar.get("tourism-session")?.value;
  if (token) {
    const [session] = await db()
      .select()
      .from(sessions)
      .where(
        and(
          eq(
            sessions.tokenHash,
            createHash("sha256").update(token).digest("hex"),
          ),
          gt(sessions.expiresAt, new Date()),
        ),
      );
    if (session) return session;
  }
  if (!create)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Start or resume a draft in this browser.",
    );
  const secret = randomBytes(32).toString("base64url");
  const session = {
    id: randomUUID(),
    tokenHash: createHash("sha256").update(secret).digest("hex"),
    role: "GUEST",
    expiresAt: new Date(Date.now() + 30 * 86400000),
  };
  await db().insert(sessions).values(session);
  jar.set("tourism-session", secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.PUBLIC_APP_URL?.startsWith("https:") ?? false,
    path: "/",
    maxAge: 30 * 86400,
  });
  return session;
}
export async function checkOrigin() {
  const h = await headers();
  if (
    h.get("origin") !== (process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000")
  )
    throw new ApiError(
      403,
      "ORIGIN_REJECTED",
      "Reload the app from its configured URL.",
    );
}
export async function requireAdmin() {
  const actor = await identity();
  if (actor.kind !== "ACCOUNT" || actor.role !== "ADMIN")
    throw new ApiError(403, "FORBIDDEN", "Administrator access required.");
  return actor;
}
export type Actor = Awaited<ReturnType<typeof identity>>;
export function ownsTrip(actor: Actor) {
  return and(eq(trips.ownerId, actor.id), eq(trips.ownerType, actor.kind));
}
export function success(data: unknown, status = 200) {
  return Response.json(
    { data, meta: { requestId: randomUUID() } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function failure(e: unknown) {
  const requestId = randomUUID();
  if (e instanceof SyntaxError)
    return Response.json(
      {
        error: { code: "INVALID_JSON", message: "Send a valid JSON request." },
        meta: { requestId },
      },
      { status: 422 },
    );
  if (e instanceof ApiError)
    return Response.json(
      { error: { code: e.code, message: e.message }, meta: { requestId } },
      { status: e.status },
    );
  return Response.json(
    {
      error: {
        code: "UNAVAILABLE",
        message:
          "Unable to load or save. Check database setup and retry; your input is retained.",
      },
      meta: { requestId },
    },
    { status: 503 },
  );
}
