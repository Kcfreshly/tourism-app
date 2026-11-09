import { headers } from "next/headers";
import { AppError } from "@/shared/application/app-error";
import { isAdmin } from "../../domain/actor";
import type { ResolveActor } from "../../application/use-cases/resolve-actor";
import type { ThrottleRequest } from "../../application/use-cases/throttle-request";

export type RequestGuards = ReturnType<typeof createRequestGuards>;

// Checks controllers run before calling a use case.
export function createRequestGuards(deps: {
  resolveActor: ResolveActor;
  throttle: ThrottleRequest;
  allowedOrigins: (host?: string | null) => string[];
}) {
  async function currentActor() {
    return deps.resolveActor.execute(await headers());
  }
  // Planning, drafts and the planner require a signed-in account. Browsing
  // the catalogue stays public.
  async function requireActor() {
    const actor = await currentActor();
    if (!actor)
      throw new AppError(
        "UNAUTHENTICATED",
        "SIGN_IN_REQUIRED",
        "Sign in to start planning and save trip drafts.",
      );
    return actor;
  }
  return {
    currentActor,
    requireActor,
    async requireAdmin() {
      const actor = await requireActor();
      if (!isAdmin(actor))
        throw new AppError(
          "FORBIDDEN",
          "FORBIDDEN",
          "Administrator access required.",
        );
      return actor;
    },
    // Same-origin writes only: the configured URL, or the host the browser
    // used (localhost and 127.0.0.1 are both common for the local demo).
    async checkOrigin() {
      const h = await headers();
      const origin = h.get("origin");
      if (!origin || !deps.allowedOrigins(h.get("host")).includes(origin))
        throw new AppError(
          "FORBIDDEN",
          "ORIGIN_REJECTED",
          "Reload the app from its configured URL.",
        );
    },
    throttle(key: string, max: number) {
      return deps.throttle.execute(key, max);
    },
  };
}
