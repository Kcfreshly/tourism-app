# Kemi service

Kemi is Ọ̀nà's AI trip companion, running as its own Node service. The Ọ̀nà web app stays the system of record for accounts, trips, catalogue and prices; the browser only reaches Kemi through the web app's `/api/v1/kemi/*` proxy (behind `KEMI_ENABLED`).

- Architecture: [`../../docs/KEMI_ARCHITECTURE.md`](../../docs/KEMI_ARCHITECTURE.md)
- How we build: [`specs/README.md`](specs/README.md) · Phases: [`specs/ROADMAP.md`](specs/ROADMAP.md) · Decisions: [`docs/adr`](docs/adr)

## Run it

```bash
cd services/kemi
npm install
cp .env.example .env   # ANTHROPIC_API_KEY, and your Langfuse keys + URL
npm run dev            # http://127.0.0.1:4100/health · POST /v1/chat
```

Through the web app: set `KEMI_ENABLED=true` in its `.env`, restart, sign in, and `useChat` posts to `/api/v1/kemi/chat`.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`.

## Layout

```
src/
├── server.ts          config → Langfuse → models → agent → listen; graceful shutdown
├── app.ts             Express: request IDs, JSON, routes, error envelope
├── http.ts            request ID + access log, sendError, error handler
├── config.ts          env schema + model profiles (the only place model IDs live)
├── logger.ts          pino with credential redaction
├── routes/
│   ├── chat.ts        POST /v1/chat: validate useChat body → agent.stream() → pipe SSE
│   └── health.ts      GET /health
├── agents/
│   ├── types.ts       ChatAgent contract: stream(input) → ReadableStream<UIMessageChunk>
│   └── kemi.ts        ToolLoopAgent → createAgentUIStream
└── ai/
    ├── models.ts      profile name → AI SDK provider registry (+ MODEL_<PROFILE> override)
    └── langfuse.ts    AI SDK telemetry → self-hosted Langfuse; withTrace(user, session)
tests/                 chat, http, config, lint boundaries
```

**Routes stream, agents think.** Routes validate HTTP input and pipe whatever stream an agent returns; they never see models, prompts or tools. Agents use the AI SDK and return a UI message stream; they never see Express. `npm run lint` enforces this. An orchestrator later implements the same `ChatAgent` interface, so routes don't change.

Add folders and dependencies only in the phase that needs them (Postgres and Redis arrive with conversation storage in Phase 2).

## Dependencies

| Package                                                                                                            | Why                                          |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `ai`, `@ai-sdk/anthropic`                                                                                          | Agents, streaming, provider registry; Claude |
| `@ai-sdk/otel`, `@langfuse/otel`, `@langfuse/tracing`                                                              | AI SDK traces to Langfuse                    |
| `@opentelemetry/api`, `sdk-trace-node`, `sdk-trace-base`, `core`, `exporter-trace-otlp-http`, `otlp-exporter-base` | Required by `@langfuse/otel` (v2 line)       |
| `express`, `zod`, `pino`                                                                                           | HTTP, validation, logs                       |
| dev: `typescript`, `tsx`, `vitest`, `supertest`, `oxlint`, `prettier`, `@types/*`                                  | Build, test, lint                            |

A second provider later: `npm install --save-exact @ai-sdk/openai`, register it in `providersFromEnv()` and point a profile at it.

The web app's `tsconfig.json`, ESLint and Vitest exclude `services/`; Kemi has its own toolchain and can move to its own repo unchanged.
