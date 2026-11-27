import { Router } from "express";

export function healthRoutes(version: string): Router {
  const router = Router();
  router.get("/health", (_request, response) => {
    response.json({
      data: { status: "ok", version },
      meta: { requestId: response.locals.requestId },
    });
  });
  return router;
}
