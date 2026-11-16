import { OpenTelemetry } from "@ai-sdk/otel";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { propagateAttributes } from "@langfuse/tracing";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { registerTelemetry } from "ai";

export type Telemetry = { enabled: boolean; shutdown(): Promise<void> };

// Sends AI SDK traces (agent runs, model calls, tool calls, tokens, cost) to
// self-hosted Langfuse. Nothing else is traced. Without Langfuse settings the
// AI SDK runs untraced.
export function startTelemetry(options: {
  langfuse?: { publicKey: string; secretKey: string; baseUrl: string } | undefined;
  environment: string;
  release: string;
}): Telemetry {
  if (!options.langfuse) return { enabled: false, shutdown: async () => {} };

  const provider = new NodeTracerProvider({
    spanProcessors: [
      new LangfuseSpanProcessor({
        ...options.langfuse,
        environment: options.environment,
        release: options.release,
      }),
    ],
  });
  provider.register();
  registerTelemetry(new OpenTelemetry());

  return { enabled: true, shutdown: () => provider.shutdown() };
}

export type TraceAttributes = {
  traceName: string;
  userId?: string | undefined;
  sessionId?: string | undefined;
  metadata?: Record<string, unknown>;
};

// Groups everything `run` starts (including streams that outlive it) under one
// Langfuse trace with the given user, session and name. Agents call this, so
// they don't depend on Langfuse directly.
export function withTrace<T>(attributes: TraceAttributes, run: () => T): T {
  const { userId, sessionId, ...rest } = attributes;
  return propagateAttributes(
    { ...rest, ...(userId ? { userId } : {}), ...(sessionId ? { sessionId } : {}) },
    run,
  );
}
