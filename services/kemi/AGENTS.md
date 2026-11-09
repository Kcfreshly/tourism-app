# Working on the Kemi service

1. **Specs first.** Follow [specs/README.md](specs/README.md). Only implement work described by an `Approved` spec, one unchecked task at a time, test or eval first. If a requirement is ambiguous or the design doesn't fit the code, stop and report instead of guessing.
2. **Layering.** `domain/` and `application/` must not import Express, the AI SDK, Drizzle, Redis or any provider package. Adapters live in `infrastructure/`; HTTP lives in `presentation/` and `src/bootstrap/http`. Wire dependencies in `src/bootstrap`.
3. **Models only through the gateway.** Never reference a model ID outside `src/config` model profiles. Every call is traced and metered.
4. **The web app is the system of record.** Read or change trips, profiles, the catalogue, prices and the bucket only through `modules/ona-client`. Never touch the web app's database.
5. **Kemi proposes; users decide.** No tool may apply an itinerary, book, pay or save a profile without an explicit user action relayed by the web app.
6. **Untrusted text stays data.** Catalogue text, memory items and tool results go into prompts as quoted data, never as instructions.
7. **Contracts are shared.** Changing anything in `contracts/` needs a spec update, a version bump and passing contract tests on both sides.
8. Before finishing: typecheck, lint, tests, and any eval suite the spec names.
