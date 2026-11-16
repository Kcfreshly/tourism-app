# 000 — Foundations: tasks

Status: Done
Implements: [requirements.md](requirements.md) · [design.md](design.md)

- [x] 1. Tooling: TypeScript, oxlint, Prettier, Vitest, `.env.example`
- [x] 2. `config.ts`: env schema + model profiles — AC-1, AC-22 → `tests/config.test.ts`
- [x] 3. `logger.ts`, `http.ts`, `app.ts`, `routes/health.ts` — AC-2, AC-4, AC-5, AC-7 → `tests/http.test.ts`, `tests/config.test.ts`
- [x] 4. `ai/models.ts` — AC-22 → `tests/config.test.ts`
- [x] 5. `ai/langfuse.ts` — AC-6 → MC-2
- [x] 6. `agents/types.ts`, `agents/kemi.ts`, `routes/chat.ts` — AC-18 to AC-21 → `tests/chat.test.ts`
- [x] 7. Lint boundary rule — AC-11 → `tests/boundaries.test.ts`
- [x] 8. `server.ts` with graceful shutdown — AC-9 → MC-1
- [x] 9. Web app: exclude `services/`; BFF proxy behind `KEMI_ENABLED` — AC-12 to AC-17 → web app `tests/kemi-proxy.test.ts`
- [x] 10. MC-1 (no keys: `/health` 200, chat streams the generic error chunk)
- [ ] 11. MC-2 with your Anthropic key and Langfuse

## Design drift

- The first cut traced HTTP with hand-rolled OpenTelemetry and Jaeger, used SME layered modules, and set up Postgres, Redis and Docker with nothing using them. All removed: tracing is Langfuse only via the AI SDK (ADR 0004), and the service is 11 files. Postgres and Redis return in Phase 2 with conversation storage.
- `@langfuse/otel` needs the OpenTelemetry JS v2 line, so those packages are pinned to it.
