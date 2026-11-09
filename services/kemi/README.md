# Kemi service

Kemi is Ọ̀nà's AI trip companion. It runs as its own Node service: it learns the traveller's persona through conversation, hands off to a planner that proposes itineraries, and remembers the user across sessions. The Ọ̀nà web app stays the system of record for accounts, trips, catalogue, prices and availability. Kemi only reaches them through the web app's internal tool API.

- Architecture: [`../../docs/KEMI_ARCHITECTURE.md`](../../docs/KEMI_ARCHITECTURE.md)
- How we build: [`specs/README.md`](specs/README.md) (spec-driven development)
- Phases to v1: [`specs/ROADMAP.md`](specs/ROADMAP.md)

Status: **skeleton only**. No code, `package.json` or config has been written yet. Phase 0 creates them.

## Stack

Node 24 · TypeScript · Express 5 · Vercel AI SDK v7 · Zod 4 · Drizzle ORM · PostgreSQL + pgvector · Redis · pg-boss · Vitest. This mirrors the layered module style of the Ọ̀nà backend (domain / application / infrastructure / presentation, composition root in `src/bootstrap`).

## Libraries to install (Phase 0)

Versions are the latest published on 2026-11-09. Pin exact versions in `package.json` when Phase 0 starts.

### Runtime

| Package | Purpose |
|---|---|
| `ai` (7.x) | AI SDK core: `ToolLoopAgent`, `streamText`, `generateText`, `Output`, `embed`, provider registry, middleware, UI message streams |
| `@ai-sdk/anthropic` (4.x) | Claude models (primary provider) |
| `@ai-sdk/openai` (4.x) *or another provider* | Second provider for fallbacks and embeddings. **Open decision**; install only the one chosen |
| `zod` (4.x) | Contracts, tool schemas, config validation |
| `express` (5.x) | HTTP server (SSE streaming endpoints) |
| `drizzle-orm` + `pg` | Postgres access |
| `pgvector` | pgvector column helpers for Drizzle and `pg` |
| `ioredis` | Working memory, per-conversation locks, quotas, stream resume |
| `pg-boss` | Background jobs (memory consolidation, embeddings, nightly evals) on Postgres; `bullmq` is the Redis-based alternative |
| `jose` | Verify the web app's on-behalf-of JWTs; sign service-to-service calls |
| `yaml` | Load versioned playbooks |
| `pino` | Structured logging |
| `@opentelemetry/sdk-node` (+ an exporter) | Tracing; AI SDK `telemetry` emits OpenTelemetry spans |
| `@langfuse/otel` *(if Langfuse is chosen)* | LLM trace export. **Open decision** (Langfuse or Phoenix or another) |
| `dotenv` | Local environment loading |

### Development

| Package | Purpose |
|---|---|
| `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/pg` | Build and dev runner |
| `drizzle-kit` | Migrations |
| `vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest` | Unit, integration and contract tests |
| `oxlint`, `prettier` | Lint and format (same as the reference API) |

### Install commands (run from `services/kemi/` in Phase 0)

```bash
npm init -y
npm install ai @ai-sdk/anthropic zod express drizzle-orm pg pgvector ioredis pg-boss jose yaml pino dotenv @opentelemetry/sdk-node
npm install -D typescript tsx @types/node @types/express @types/pg drizzle-kit vitest @vitest/coverage-v8 supertest @types/supertest oxlint prettier
# after the open decisions are made:
# npm install @ai-sdk/openai          # or the chosen second / embeddings provider
# npm install @langfuse/otel          # or the chosen observability exporter
```

### Infrastructure (local)

`docker/compose.yaml` (Phase 0): `pgvector/pgvector` Postgres image and `redis`.

In the web app, the chat UI uses `@ai-sdk/react` (`useChat`). That package is installed in the web app, not here.

## Folder layout

```
services/kemi/
├── README.md                 this file
├── AGENTS.md                 rules for coding agents working in this service
├── specs/                    spec-driven development: one folder per spec, numbered by phase
│   ├── README.md             the process
│   ├── ROADMAP.md            phases and exit criteria to v1
│   ├── _templates/           requirements.md, design.md, tasks.md
│   └── 000-… 080-…           one folder per spec
├── docs/adr/                 architecture decision records (one decision per file)
├── contracts/                shared Zod contracts: API envelopes, handoff packet, profile patch,
│                             proposal, UI data parts (later published for the web app BFF)
├── playbooks/                versioned procedural memory (YAML + prompt text) per agent
│   ├── persona-intake/  planner/  concierge/  router/
├── src/
│   ├── bootstrap/            composition root: container, Express app, routes, middleware
│   ├── config/               env schema (Zod), model profiles config
│   ├── shared/               errors, logging, common types (no framework code)
│   ├── database/schema/      Drizzle tables (kemi schema)
│   ├── modules/
│   │   ├── conversation/     conversations, messages, SSE streaming, UI actions
│   │   ├── orchestration/    supervisor state machine, intent routing, handoff packets
│   │   ├── agents/           router, intake, planner, concierge (+ their tools)
│   │   ├── memory/           working (Redis), episodic, semantic (pgvector), context assembly
│   │   ├── playbooks/        playbook registry, versions, rollout
│   │   ├── gateway/          model profiles, provider registry, fallbacks, middleware
│   │   ├── ona-client/       typed client for the web app's /internal/kemi tool API
│   │   └── llmops/           telemetry setup, token/cost metering
│   └── workers/              consolidation, embeddings, scheduled evals
├── drizzle/                  generated migrations
├── evals/                    datasets, simulated-user scripts, graders, reports
├── tests/                    unit, integration, contract, fixtures
├── scripts/                  dev and ops scripts
└── docker/                   local Postgres + pgvector and Redis
```

Each module follows `domain/` (pure types and rules) → `application/` (`ports/` interfaces + `use-cases/`) → `infrastructure/` (adapters) → `presentation/` (HTTP). Domain and application code import no framework, SDK or database packages. Only infrastructure does.

## Repository notes

- The web app's root `tsconfig.json`, ESLint and Vitest configs must exclude `services/` before Phase 0 adds TypeScript files here. Otherwise the web app will try to typecheck Kemi with the wrong dependencies.
- This folder is self-contained, so it can move to its own repository without changes.
