import { cookies, headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, trips, user } from "./schema";
import { auth } from "./auth";
import { allowedOrigins } from "./config";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// Planning, drafts and the planner require a signed-in account. Browsing the
// catalogue and the bucket stay public.
export async function identity() {
  const account = await accountIdentity();
  if (!account)
    throw new ApiError(
      401,
      "SIGN_IN_REQUIRED",
      "Sign in to start planning and save trip drafts.",
    );
  return account;
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
// Legacy guest drafts are only read so they can be linked to an account.
export async function guestIdentity() {
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
  throw new ApiError(
    401,
    "UNAUTHENTICATED",
    "No guest drafts in this browser.",
  );
}
// Same-origin writes only: the configured URL, or the host the browser used
// (localhost and 127.0.0.1 are both common for the local demo).
export async function checkOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin || !allowedOrigins(h.get("host")).includes(origin))
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
