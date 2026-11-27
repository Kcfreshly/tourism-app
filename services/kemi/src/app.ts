import express, { type Express } from "express";

import type { ChatAgent } from "./agents/types.js";
import { errorHandler, notFound, requestId } from "./http.js";
import type { Logger } from "./logger.js";
import { chatRoutes } from "./routes/chat.js";
import { healthRoutes } from "./routes/health.js";

// HTTP only. The agent arrives ready-made from server.ts.
export function createApp({
  logger,
  chat,
  version,
}: {
  logger: Logger;
  chat: ChatAgent;
  version: string;
}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId(logger));
  app.use(express.json({ limit: "256kb" }));

  app.use(healthRoutes(version));
  app.use("/v1", chatRoutes(chat));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
