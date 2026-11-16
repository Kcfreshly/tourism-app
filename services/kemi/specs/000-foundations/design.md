# 000 — Foundations: design

Status: Done
Implements: [requirements.md](requirements.md)

## Overview

Eleven source files. Routes handle HTTP; agents do the AI work; one contract joins them.

```
server.ts ── config.ts (env + model profiles)
   │         ai/langfuse.ts  startTelemetry(): NodeTracerProvider + LangfuseSpanProcessor + registerTelemetry(new OpenTelemetry())
   │         ai/models.ts    createModels(): provider registry + defaultSettingsMiddleware + MODEL_<PROFILE>
   │         agents/kemi.ts  ToolLoopAgent → createAgentUIStream, wrapped in withTrace()
   └─ app.ts ── http.ts (request ID, sendError, error handler)
                routes/health.ts  GET /health
                routes/chat.ts    POST /v1/chat → agent.stream() → pipeUIMessageStreamToResponse
```

```ts
// agents/types.ts — the only thing routes know about agents
type ChatInput = {
  conversationId: string;
  messages: UIMessage[];
  requestId: string;
  userId?: string;
  signal: AbortSignal;
};
interface ChatAgent {
  stream(input: ChatInput): Promise<ReadableStream<UIMessageChunk>>;
}
```

An orchestrator (Phase 2) implements `ChatAgent` too and hands off between agents internally; routes don't change.

## Configuration

`.env` is loaded with Node's `--env-file-if-exists` (no dotenv). Nothing is required. `ANTHROPIC_API_KEY` (missing: warning, chat runs fail with the generic error chunk), `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` (all or none), `MODEL_<PROFILE>`, plus `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `SERVICE_VERSION`. Web app: `KEMI_ENABLED`, `KEMI_URL`.

## Failure modes

| Failure                 | Behaviour                                            |
| ----------------------- | ---------------------------------------------------- |
| Invalid setting         | `ConfigError` names each key; exit 1                 |
| Model or provider error | `error` chunk with a generic message; details logged |
| Client disconnects      | Agent run aborted                                    |
| Langfuse unreachable    | Spans dropped; chat unaffected                       |
| Kemi down (BFF)         | 503 `KEMI_UNAVAILABLE`                               |

## Testing

`tests/chat.test.ts` (real Kemi agent on `MockLanguageModelV4`, and the route with a fake `ChatAgent`), `tests/http.test.ts`, `tests/config.test.ts` (env, profiles, log redaction), `tests/boundaries.test.ts` (lint rule). Web app: `tests/kemi-proxy.test.ts`.
