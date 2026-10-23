# Milestone status — 21 October 2026

A foundation features and B core planner are implemented, with browser acceptance still pending. C–E have not started. No real booking/payment can be made.

Current delivery: Better Auth demo accounts; server-owned roles; transactional exactly-once guest draft merge; sign-out/invalidation; admin draft/review/verify/publish/pause and audit; public catalogue API; write rate limits; 4 migrations; bounded deterministic intake helper with preview/apply; multi-day add/edit/move/remove/lock/undo; accessible button alternatives and native modal dialogs; server autosave with conflicts/recovery; deterministic catalogue proposal diff/apply with persisted expiry/version checks; configurable driver/guide windows; integer NGN prices and route/support blockers.

Latest verification: 19 unit tests passed, including every supplied pricing arithmetic case. Typecheck, lint, formatting check and the optimized Next.js build passed. API checks passed guest and account ownership, sign-in/merge/re-login, role escalation denial, stale write/proposal conflicts, lock preservation, exact total and catalogue lifecycle/live-promotion refusal. All existing public pages returned HTTP 200 with demo banner. Remote CI has not been run.

Remaining A/B acceptance: browser screenshots, keyboard/focus/drag testing and 390/768/1440px overflow checks. CUA inventory still has no browsers/apps. Deterministic fallback is not a live model; broad language understanding, accessibility/arrival preferences and real provider adapters remain pending. Transport matrix/rates/policies/supply remain fictional. No payment/assignment/refund test or real PostgreSQL race test ran.

Important assumptions: activity-day vehicle rates use explicit 4/8-hour windows, with conservative peak pickup allowance and configured return buffer. A custom-only day buys no vehicle. Unknown base/routes or an overlong service day block checkout. The supplied 08:30 pickup example conflicts with the 45-minute peak Lekki buffer for a 09:00 activity; the planner flags that window and the arithmetic integration test uses 08:00–16:00. No live traffic claim is made.

## Original first-slice record (historical; superseded above)

| Requirement | Evidence / remaining work |
|---|---|
| Read full handoff, contracts, QA, SVGs and overview | Reviewed before domain implementation; conflicts recorded in plan |
| Database / migrations / seeds | Applied migration 0001; 12 fictional seeds; UUID database IDs and fixture seed keys |
| Guest draft reload and private access | HTTP check passes with independent session cookies |
| Shared chat/form profile | Shared React state; save/reload works through API; chat is only a labelled shell |
| Login merge | Not implemented; no account provider configured |
| Admin publication | Guarded denial endpoints and demo refusal; usable draft/verify/publish workflow pending |
| Planner / total pricing | Not implemented; no capacity or total-price promises |
| Checkout / provider | Not implemented; immediate checkout remains the required milestone C behavior |
| Browser screenshots / keyboard / overflow | Blocked: browser inventory returned no apps or browsers; not checked |
| Full QA acceptance | Pending; HTTP owner/conflict checks cover only portions of A27/A28 |

Checks actually run: TypeScript, ESLint, 4 Vitest tests, optimized local-demo Next build, migration, seed, HTTP integration script. HTTP script checks invalid party, wrong origin, version conflict, cross-session read/write denial, staff read/write denial and invalidated session. No sandbox payment, actual PostgreSQL race, refund or assignment test was run. CI file added but remote CI was not run.

Dependency audit: 5 high findings in the development lint chain, all traced to unpatched braces GHSA-vfj7-8cjw-p6xm. No insecure certificate bypass was used; Node system CA resolved installation. Windows sandbox user-lookup error required approved migration/seed retry. Docker binary exists but daemon was unavailable.

Next work: maintainable authentication + ownership-preserving guest merge, catalogue admin workflow/audit, request throttling, schema-backed offer selection, complete API envelopes; then schedule editor and deterministic price engine using supplied arithmetic fixtures. Browser QA remains required before claiming A complete.
