import { headers } from "next/headers";
import { controller, success } from "@/shared/presentation/http/responses";
import type { EndSession } from "../../../application/use-cases/end-session";
import type { RequestGuards } from "../request-guards";
import { forgetGuest, guestToken } from "../guest-cookie";

export function createEndSessionController(
  guards: RequestGuards,
  endSession: EndSession,
) {
  return controller(async () => {
    await guards.checkOrigin();
    const token = await guestToken();
    await endSession.execute({ headers: await headers(), guestToken: token });
    await forgetGuest();
    return success({ signedOut: true });
  });
}
