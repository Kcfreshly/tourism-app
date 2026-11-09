import { randomUUID } from "node:crypto";
import { AppError, type AppErrorKind } from "../../application/app-error";

const statusFor: Record<AppErrorKind, number> = {
  INVALID: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
};

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
  if (e instanceof AppError)
    return Response.json(
      { error: { code: e.code, message: e.message }, meta: { requestId } },
      { status: statusFor[e.kind] },
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

// Wraps a controller so any thrown refusal becomes the standard error envelope.
export function controller<A extends unknown[]>(
  run: (...args: A) => Promise<Response>,
) {
  return async (...args: A) => {
    try {
      return await run(...args);
    } catch (e) {
      return failure(e);
    }
  };
}

export type IdParams = { params: Promise<{ id: string }> };
