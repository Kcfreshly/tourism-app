# 0003 — Build agents on the Vercel AI SDK v7

Status: Accepted, 2026-11-09

## Context

Kemi needs tool-calling agents, structured output, streaming to a React chat UI, several model providers with fallbacks, and OpenTelemetry spans for every model call. Options considered: AI SDK, LangGraph/deepagents, provider SDKs directly.

## Decision

Use `ai` 7.x (`ToolLoopAgent`, `streamText`, `generateText`, `Output`, `embed`, `createProviderRegistry`, `wrapLanguageModel`, UI message streams) with `@ai-sdk/*` provider packages. Orchestration (the supervisor state machine and handoffs) is our own code, not a framework graph.

## Consequences

- One TypeScript stack from the web app's `useChat` to the agents, with typed tools via Zod.
- Provider switching and fallbacks happen in the model gateway through profiles, not in agent code.
- We own the orchestration logic, so it is plain, unit-tested functions.
- Only `infrastructure` code (the gateway and agent adapters) imports the SDK; lint enforces this.
