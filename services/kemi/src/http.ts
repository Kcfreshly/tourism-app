import { randomUUID } from "node:crypto";

import type { ErrorRequestHandler, RequestHandler, Response } from "express";

import type { Logger } from "./logger.js";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      log: Logger;
    }
  }
}

// Error envelope shared with the web app: { error: { code, message }, meta: { requestId } }.
export function sendError(response: Response, status: number, code: string, message: string) {
  response
    .status(status)
    .json({ error: { code, message }, meta: { requestId: response.locals.requestId } });
}

const requestIdPattern = /^[A-Za-z0-9_-]{8,64}$/;

// Reuses the web app's request ID (or makes one) and writes one log line per
// request, so a traveller's request can be found in both services' logs.
export function requestId(logger: Logger): RequestHandler {
  return (request, response, next) => {
    const incoming = request.get("x-request-id");
    const id = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
    const started = performance.now();
    response.locals.requestId = id;
    response.locals.log = logger.child({ requestId: id });
    response.setHeader("x-request-id", id);
    // "close" also fires when the client leaves mid-stream (logged as 499).
    response.once("close", () => {
      const status = response.writableFinished ? response.statusCode : 499;
      response.locals.log[status >= 500 ? "error" : "info"](
        {
          method: request.method,
          path: request.path,
          status,
          durationMs: Math.round(performance.now() - started),
        },
        "request",
      );
    });
    next();
  };
}

export const notFound: RequestHandler = (_request, response) =>
  sendError(response, 404, "NOT_FOUND", "No such endpoint.");

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  const type = (error as { type?: unknown }).type;
  if (type === "entity.parse.failed")
    return sendError(response, 422, "INVALID_JSON", "Send a valid JSON request.");
  if (type === "entity.too.large")
    return sendError(response, 422, "REQUEST_TOO_LARGE", "The request body is too large.");
  response.locals.log.error({ err: error }, "unhandled request error");
  sendError(response, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
};
