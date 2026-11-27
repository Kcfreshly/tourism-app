import { randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import { controller } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import {
  KemiUnavailable,
  type KemiGateway,
} from "../../../application/ports/kemi-gateway";

export type KemiPathParams = { params: Promise<{ path: string[] }> };

const segmentPattern = /^[A-Za-z0-9_-]{1,64}$/;
const maxSegments = 8;
const maxBodyBytes = 256 * 1024;

// The only way from the browser to Kemi (ADR 0001). Checks the flag, the
// session, the origin and the rate limit, then forwards with a fresh request
// ID. Cookies and the caller's headers are not forwarded.
export function createKemiProxyController(
  guards: RequestGuards,
  kemi: KemiGateway,
  enabled: () => boolean,
) {
  return controller(async (request: Request, { params }: KemiPathParams) => {
    if (!enabled())
      throw new AppError(
        "NOT_FOUND",
        "KEMI_DISABLED",
        "Kemi isn't available yet. Use the trip form instead.",
      );
    const method = request.method === "POST" ? "POST" : "GET";
    if (method !== "GET") await guards.checkOrigin();
    const actor = await guards.requireActor();
    await guards.throttle(`kemi:${actor.id}`, 60);

    const { path } = await params;
    if (path.length > maxSegments || !path.every((s) => segmentPattern.test(s)))
      throw new AppError("NOT_FOUND", "NOT_FOUND", "No such endpoint.");

    const tooLarge = new AppError(
      "INVALID",
      "REQUEST_TOO_LARGE",
      "That message is too long. Shorten it and try again.",
    );
    if (Number(request.headers.get("content-length")) > maxBodyBytes)
      throw tooLarge;
    const body = method === "POST" ? await request.arrayBuffer() : null;
    if (body && body.byteLength > maxBodyBytes) throw tooLarge;

    const requestId = randomUUID();
    try {
      const upstream = await kemi.forward({
        method,
        path: `/v1/${path.join("/")}`,
        search: new URL(request.url).search,
        body,
        contentType: request.headers.get("content-type"),
        accept: request.headers.get("accept"),
        requestId,
        signal: request.signal,
      });
      const headers = new Headers({
        "Cache-Control": "private, no-store",
        "x-request-id": upstream.headers.get("x-request-id") ?? requestId,
      });
      const contentType = upstream.headers.get("content-type");
      if (contentType) headers.set("content-type", contentType);
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (e) {
      if (!(e instanceof KemiUnavailable)) throw e;
      return Response.json(
        {
          error: {
            code: "KEMI_UNAVAILABLE",
            message:
              "Kemi is unavailable right now. Use the trip form; your details are kept.",
          },
          meta: { requestId },
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "private, no-store",
            "x-request-id": requestId,
          },
        },
      );
    }
  });
}
