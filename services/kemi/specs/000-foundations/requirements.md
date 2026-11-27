# 000 — Foundations: requirements

Status: Done
Phase: 0 · Related: [ROADMAP](../ROADMAP.md), ADRs [0001](../../docs/adr/0001-service-boundary.md), [0002](../../docs/adr/0002-on-behalf-of-auth.md), [0003](../../docs/adr/0003-ai-sdk-v7.md), [0004](../../docs/adr/0004-langfuse-tracing.md)

## Problem

Every later phase needs a small, running Kemi: a streaming chat route that is separate from the agent that answers, model profiles that hide providers behind the AI SDK, agent traces in our self-hosted Langfuse, and one gated path from the browser through the web app.

## Goals

- A signed-in traveller's chat message goes through the web app to Kemi, and the answer streams back.
- Every agent run appears in Langfuse with its model calls, tokens and conversation.
- Agents choose a model profile, not a provider; switching provider is configuration.
- As few moving parts as possible: no database, cache or placeholder code until a phase needs it.

## Non-goals

- Conversation storage, Postgres, Redis (Phase 2); tools, orchestration, memory, playbooks (Phases 2–5).
- On-behalf-of tokens (Phase 1, ADR 0002); until then no user ID reaches Kemi or Langfuse.
- Tracing anything other than AI SDK runs (ADR 0004).

## Acceptance criteria

Numbers are stable. AC-3 (readiness), AC-8 (status endpoint) and AC-10 (migrations) were dropped; they return with Postgres in Phase 2.

### Service

- **AC-1:** WHEN a setting is invalid THE SYSTEM SHALL exit with a non-zero code and name each invalid setting without printing its value. No setting is required to start.
- **AC-2:** WHEN `GET /health` is called THE SYSTEM SHALL return 200 `{ data: { status: "ok", version } }`.
- **AC-4:** WHEN a request carries an `x-request-id` of 8–64 letters, digits, `-` or `_` THE SYSTEM SHALL use it; otherwise generate one. The ID SHALL appear in the response header, in `meta.requestId` of JSON envelopes, and in the request's log line.
- **AC-5:** Unknown routes SHALL get 404 `NOT_FOUND`, malformed JSON 422 `INVALID_JSON`, and unexpected errors 500 `INTERNAL_ERROR` without internal detail, all in `{ error: { code, message }, meta: { requestId } }`.
- **AC-6:** WHEN `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL` are set THE SYSTEM SHALL export AI SDK spans (only those) to that Langfuse, each chat run named `kemi.chat` with the conversation ID as session and the request ID as metadata. If only some are set it SHALL refuse to start; if none are set it SHALL run untraced and log a warning.
- **AC-7:** Logs SHALL NOT contain `authorization` or `cookie` values.
- **AC-9:** WHEN the process receives SIGTERM or SIGINT THE SYSTEM SHALL stop accepting connections, let in-flight streams finish, flush Langfuse and exit (forced exit 1 after 10 seconds).
- **AC-11:** `npm run lint` SHALL fail WHEN a file in `src/routes`, `src/http.ts` or `src/app.ts` imports a provider package, Langfuse, `src/ai/*` or a concrete agent, or WHEN a file in `src/agents` imports Express, routes, HTTP helpers, a provider package or Langfuse directly.

### Chat and models

- **AC-18:** WHEN `POST /v1/chat` receives `{ id, messages }` (the `useChat` body) with valid UI messages THE SYSTEM SHALL pass them to the chat agent and stream its UI message stream back unchanged as SSE (`text/event-stream`, `x-vercel-ai-ui-message-stream: v1`) with the request ID header.
- **AC-19:** WHEN `id` is missing, there are no messages or more than 200, or messages are malformed THE SYSTEM SHALL answer 422 (`INVALID_CHAT_REQUEST` or `INVALID_MESSAGES`) without calling the agent.
- **AC-20:** WHEN the client disconnects before the stream ends THE SYSTEM SHALL abort the agent run.
- **AC-21:** WHEN the model fails during a run THE SYSTEM SHALL send an `error` chunk with a generic message, log the error, and never send the provider's error text to the client.
- **AC-22:** Agents SHALL get models only by profile name from `src/config.ts`, with the profile's default settings applied. `MODEL_<PROFILE>` SHALL override the `provider:model`. An unregistered provider SHALL fail with an error naming it.

### Web app (BFF)

- **AC-12:** WHEN `KEMI_ENABLED` is not `true`, every `/api/v1/kemi/*` request SHALL get 404 `KEMI_DISABLED`.
- **AC-13:** Signed-out callers SHALL get 401 `SIGN_IN_REQUIRED`, and non-GET requests from a foreign origin 403 `ORIGIN_REJECTED`. Requests are throttled per account.
- **AC-14:** Invalid paths (segments not 1–64 letters, digits, `-` or `_`, or more than 8 segments) SHALL get 404 without calling Kemi; bodies over 256 KB SHALL get 422 `REQUEST_TOO_LARGE`.
- **AC-15:** Allowed requests SHALL be forwarded to `KEMI_URL/v1/<path>` with the query string and a new request ID, without the caller's cookies or authorization, and Kemi's status, content type, request ID and streamed body SHALL be returned.
- **AC-16:** WHEN Kemi is unreachable or sends no headers within 10 seconds, the BFF SHALL answer 503 `KEMI_UNAVAILABLE`, pointing the traveller to the trip form.
- **AC-17:** The web app's `typecheck`, `lint` and `test` SHALL NOT read `services/`.

## Manual checks

- **MC-1:** `npm run dev`: `/health` returns 200, and `POST /v1/chat` streams (without a key, a generic `error` chunk).
- **MC-2:** With your Anthropic key and Langfuse set, and the web app on `KEMI_ENABLED=true`, a signed-in `POST /api/v1/kemi/chat` streams Kemi's answer and the run appears in Langfuse as `kemi.chat`.
