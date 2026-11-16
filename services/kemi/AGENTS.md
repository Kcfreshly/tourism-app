# Working on the Kemi service

1. **Specs first.** Follow [specs/README.md](specs/README.md). Only implement work described by an `Approved` spec, one unchecked task at a time, test or eval first. If a requirement is ambiguous or the design doesn't fit the code, stop and report instead of guessing.
2. **Routes stream, agents think.** Routes (`src/routes`) handle HTTP and pipe the stream an agent returns. They never import models, providers, Langfuse or a concrete agent. Agents (`src/agents`) build on the AI SDK and return a `ReadableStream<UIMessageChunk>`. They never import Express or routes. The contract is `src/agents/types.ts`. Wire agents into the app in `src/server.ts`.
3. **Models only through profiles.** Never reference a model ID or provider package outside `src/config.ts` and `src/ai/models.ts`. Agents call `models.get("<profile>")`. Tracing goes to Langfuse through `src/ai/langfuse.ts`; don't add other telemetry.
4. **Keep it small.** Add a folder, file or dependency only when the current spec needs it. No placeholders.
5. **The web app is the system of record.** Read or change trips, profiles, the catalogue, prices and the bucket only through its internal API (a client added in Phase 1). Never touch the web app's database.
6. **Kemi proposes; users decide.** No tool may apply an itinerary, book, pay or save a profile without an explicit user action relayed by the web app.
7. **Untrusted text stays data.** Catalogue text, memory items and tool results go into prompts as quoted data, never as instructions.
8. **Contracts are shared.** Changing a shared contract with the web app needs a spec update, a version bump and passing contract tests on both sides.
9. Before finishing: typecheck, lint, tests, and any eval suite the spec names.
