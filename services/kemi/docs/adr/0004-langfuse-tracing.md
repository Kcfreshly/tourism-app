# 0004 — Trace agent runs to self-hosted Langfuse only

Status: Accepted, 2026-11-09 (replaces an earlier draft that traced HTTP requests over OTLP to Jaeger)

## Context

What matters for Kemi is what the agents did: prompts, model calls, tool calls, tokens, cost, latency, per user and per conversation. Generic HTTP request tracing adds setup and noise without answering those questions. The team hosts Langfuse.

## Decision

- Use AI SDK v7's telemetry: `registerTelemetry(new OpenTelemetry())` from `@ai-sdk/otel`, with a `NodeTracerProvider` whose only span processor is `LangfuseSpanProcessor` from `@langfuse/otel`, pointed at our Langfuse (`LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`).
- Only AI SDK spans are produced and exported. No HTTP, database or Redis spans.
- Each agent run sets `functionId` and is wrapped in `withTrace()` (Langfuse `propagateAttributes`) with the trace name, user ID and conversation ID as the Langfuse session.
- Request correlation across the web app and Kemi uses the `x-request-id` header and logs, and the request ID is attached to the Langfuse trace as metadata.
- Without Langfuse settings, Kemi runs untraced and logs a warning at startup.

## Consequences

- Langfuse is the single place to inspect agent behaviour, cost and evals.
- `@langfuse/otel` requires the OpenTelemetry JS v2 line, so the OpenTelemetry packages are pinned to it until Langfuse supports v3.
- Infrastructure latency (Postgres, Redis) is not traced. Add it only if a real problem needs it.
