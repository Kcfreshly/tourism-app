// Entry point: config → Langfuse → models → agent → HTTP.
import { createKemiAgent } from "./agents/kemi.js";
import { startTelemetry } from "./ai/langfuse.js";
import { createModels, providersFromEnv } from "./ai/models.js";
import { createApp } from "./app.js";
import { ConfigError, loadEnv, type Env } from "./config.js";
import { createLogger } from "./logger.js";

let env: Env;
try {
  env = loadEnv(process.env);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const logger = createLogger(env.LOG_LEVEL);

// Register telemetry before any agent is created.
const telemetry = startTelemetry({
  langfuse:
    env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY && env.LANGFUSE_BASE_URL
      ? {
          publicKey: env.LANGFUSE_PUBLIC_KEY,
          secretKey: env.LANGFUSE_SECRET_KEY,
          baseUrl: env.LANGFUSE_BASE_URL,
        }
      : undefined,
  environment: env.NODE_ENV,
  release: env.SERVICE_VERSION,
});
if (!telemetry.enabled) logger.warn("Langfuse is not configured; agent runs are not traced");
if (!env.ANTHROPIC_API_KEY) logger.warn("ANTHROPIC_API_KEY is not set; chat requests will fail");

const models = createModels({ providers: providersFromEnv(env), overrides: process.env });
const app = createApp({
  logger,
  chat: createKemiAgent({ models, logger }),
  version: env.SERVICE_VERSION,
});

const server = app.listen(env.PORT, env.HOST, () =>
  logger.info({ host: env.HOST, port: env.PORT }, "kemi listening"),
);

// Finish in-flight streams, flush Langfuse, exit. Forced after 10 s.
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  setTimeout(() => process.exit(1), 10_000).unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await telemetry
    .shutdown()
    .catch((error: unknown) => logger.error({ err: error }, "langfuse flush failed"));
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
