# Kemi v1 roadmap

Status: Draft, 2026-11-09

**v1 definition.** A signed-in traveller can chat with Kemi:

- Kemi welcomes them, fills the trip profile and captures useful persona facts.
- After the traveller confirms the summary, the draft is saved through the web app.
- When the traveller asks Kemi to plan, it hands off to the planner. The planner proposes a valid itinerary and adds more options to the bucket. The traveller accepts or dismisses the proposal.
- Kemi remembers the traveller across sessions, and the traveller can see and delete what it remembers.
- All of this runs behind a feature flag, with tracing, evals, cost limits and a fallback to the manual form.

Each phase is one or more specs (folder numbers in brackets). A phase starts when the previous phase meets its exit criteria.

---

## Phase 0: Foundations `[000-foundations]` — Done 2026-11-09

The smallest service that streams an agent's answer and traces it.

- `package.json`, `tsconfig`, oxlint, Prettier, Vitest.
- Env schema (Zod) that fails fast on invalid settings.
- Express app with `/health`, request IDs, the shared error envelope and pino logging.
- Streaming `POST /v1/chat` route, separate from the agent that answers (`ChatAgent` contract). Model profiles over the AI SDK provider registry. Agent traces to self-hosted Langfuse.
- **Web app side:** exclude `services/` from the root TypeScript, ESLint and Vitest configs. Add the `/api/v1/kemi/*` BFF proxy behind a feature flag.
- ADRs: 0001 service boundary, 0002 on-behalf-of auth, 0003 AI SDK v7, 0004 Langfuse tracing.

**Exit criteria:** `npm run dev`, `typecheck`, `lint` and `test` pass; a chat message through the BFF streams Kemi's answer back, and the run appears in Langfuse.

## Phase 1: Contracts and model gateway `[010-contracts]` `[020-model-gateway]`

Fix the shapes everything else depends on, and the way models are called.

- Contracts: API error envelope, conversation and message DTOs, UI data parts (summary card, proposal), `ProfilePatch`, `PersonaFact`, `HandoffPacket`, `Proposal`.
  - The profile contract mirrors the web app's `profileSchema`, field for field. A contract test fails if they drift.
- On-behalf-of token verification (`jose`), with scopes checked per route and per tool.
- Model gateway:
  - Profiles config: `kemi.router`, `kemi.chat`, `planner.reason`, `memory.extract`, `embed.default`, `eval.judge`.
  - Provider registry, fallback chain, timeouts, per-conversation token and cost caps.
  - Middleware: tracing, metering, log redaction.
- `ona-client`: a typed client for the web app's internal tool API. In this phase it's backed by a fake, plus contract tests.

**Exit criteria:** contract tests pass on both sides; any model call goes through a profile; fallback is proven by a test with a failing fake provider; every call records tokens and cost.

## Phase 2: Conversation API and orchestration `[030-conversation-api]` `[040-orchestration]`

Streamed conversations with a deterministic supervisor.

- `POST /v1/conversations`, `POST /v1/conversations/:id/messages` (SSE, AI SDK UI message stream), stream resume, paged history, `POST …/actions`.
- Add Postgres (Drizzle, `kemi` schema, `docker/compose.yaml`) and Redis now: `conversations` and `messages` tables, and a Redis per-conversation lock so only one turn runs at a time.
- Supervisor state machine: Welcome → Intake → ConfirmProfile → ProfileSaved → Concierge or Planning → ProposalReview. Transitions are pure functions with full unit-test coverage.
- Intent router agent (structured output) feeding the state machine.
- Playbook registry: load versioned YAML, record the playbook version on every run.

**Exit criteria:** every transition in the state diagram is unit-tested, including illegal ones; router eval accuracy ≥ 90% on the labelled intent set; a dropped stream resumes without losing messages.

## Phase 3: Intake agent (user persona) `[050-intake-agent]`

The first user-visible value: Kemi fills the profile through conversation.

- `persona-intake` playbook v1.
- Tools: `get_profile_state`, `update_profile_fields`, `record_persona_fact`, `ready_for_summary`.
- `prepareStep` injects missing and invalid fields each step.
- Summary card data part. On `confirm_profile`, the supervisor saves through the web app (create or update, with version checks).
- Working memory: the draft profile lives in Redis, with a snapshot in Postgres.
- Simulated-user eval harness, plus an intake golden set (≥ 50 conversations at first).
- **Web app side:** chat UI with `useChat` on the existing intake screen behind the flag; the manual form stays.

**Exit criteria (intake eval):**

- Field accuracy ≥ 95%.
- Invented values = 0.
- Median turns to a complete profile ≤ 6.
- At most two questions per turn in ≥ 95% of turns.
- The summary saves a valid draft through the real web app API.

## Phase 4: Memory `[060-memory]`

Kemi remembers.

- `memory_items` with pgvector. Hot-path fact writes with provenance and a confidence cap.
- Session summaries. `assembleContext()` with a fixed token budget and stable ordering for prompt caching.
- pg-boss consolidation job: extract, dedupe, supersede.
- `GET` and `DELETE /v1/memory`. **Web app side:** a "What Kemi remembers" view in the account page.
- A returning user's known facts are used without being asked again.

**Exit criteria:**

- Memory eval precision ≥ 90% and recall ≥ 80%.
- Contradictions are superseded correctly.
- Deleted facts never reappear in context (tested).
- Context assembly stays within budget (tested).
- The prompt cache hit rate is visible in traces.

## Phase 5: Planner handoff `[070-planner-handoff]`

"Kemi, plan my trip."

- `HandoffPacket` from Intake or Concierge to the Planner.
- Catalogue embeddings, refreshed on catalogue change.
- Planner tools: `get_trip_context`, `search_experiences` (SQL filters + vector), `draft_schedule`, `validate_schedule`, `price_plan`, `suggest_bucket_additions`, `present_proposal`.
- Validate–repair loop, at most 3 repairs. `present_proposal` re-validates on the server.
- **Web app side:** internal tool endpoints that wrap the existing `propose`, `placementIssues` and `assess`; a proposal card in the planner; accept goes through the existing `plan/apply` endpoint with `expectedVersion`. Bucket suggestions are tagged `source=kemi`.
- Itinerary pattern library: ops-curated templates only for v1.

**Exit criteria (planner eval):**

- 100% of presented proposals pass validation.
- Budget adherence ≥ 95%.
- Interest coverage ≥ 90%.
- No calendar change happens without the user accepting it (tested).

## Phase 6: LLM operations hardening and v1 launch `[080-llmops-hardening]`

Safe to turn on for real users.

- Safety eval set: prompt injection through catalogue and memory text, off-topic requests, PII echo.
- Per-user quotas, global spend cap, kill switch to the manual form.
- Dashboards: completion, turns, acceptance, fallback and refusal rates, p95 time to first token, cost per completed profile and per accepted plan.
- Nightly eval run, with regression alerts. Playbook and profile rollout by percentage.
- Runbooks: provider outage, web app API outage, Redis loss, cost spike.
- Staged rollout: internal → 10% → 100% of signed-in users.

**Exit criteria (v1 done):**

- All suites meet their thresholds for 7 consecutive nightly runs.
- The kill switch has been drilled.
- Cost per completed profile is within the agreed budget.
- The product owner signs off.

---

## After v1 (not in scope)

Itinerary patterns learned from accepted plans (with consent) · user standing rules ("always ask before nightlife") · server-side voice · WhatsApp channel · Concierge for in-trip help.

## Open decisions (resolve via ADR before the phase that needs them)

| Decision                                                                                                                | Needed by |
| ----------------------------------------------------------------------------------------------------------------------- | --------- |
| Second model provider and embeddings provider                                                                           | Phase 1   |
| ~~Observability backend~~: self-hosted Langfuse ([ADR 0004](../docs/adr/0004-langfuse-tracing.md))                      | Decided   |
| ~~Separate Postgres cluster or schema~~: own database, `kemi` schema ([ADR 0001](../docs/adr/0001-service-boundary.md)) | Decided   |
| Retention period and data residency for conversations and memory                                                        | Phase 4   |
| Cost budget per completed profile and per accepted plan                                                                 | Phase 6   |
