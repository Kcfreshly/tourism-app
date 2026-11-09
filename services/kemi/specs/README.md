# Spec-driven development for Kemi

Every change to Kemi starts as a written, reviewed spec. Code, tests and evals are produced *from* the spec, and the spec stays true after the code ships. An AI coding agent or a person should be able to implement a spec without asking what was meant.

## The loop

```
1. Requirements  →  2. Design  →  3. Tasks  →  4. Contracts + failing tests/evals  →  5. Implement  →  6. Verify  →  7. Close
   (what & why)      (how)          (steps)       (the spec made executable)            (smallest diff)    (all green)     (spec = reality)
```

| Step | Output | Gate |
|---|---|---|
| 1. Requirements | `requirements.md`: user stories plus numbered acceptance criteria | Reviewed and marked `Approved` by the product owner |
| 2. Design | `design.md`: modules touched, contracts, data, sequence, failure modes, ADR links | Reviewed and marked `Approved` |
| 3. Tasks | `tasks.md`: ordered checklist; every task cites the acceptance criteria it satisfies | Every acceptance criterion is covered by at least one task |
| 4. Contracts and tests first | Zod schemas in `contracts/`; failing unit, contract and integration tests; eval cases for model behaviour | Tests fail for the right reason |
| 5. Implement | Code, one task at a time; tick tasks off | Typecheck, lint and tests pass |
| 6. Verify | Evals run against the spec's thresholds; manual walkthrough for user-facing flows | Thresholds met; results saved to `evals/reports/` |
| 7. Close | Spec status `Done`; any design drift written back into `design.md` | No open tasks |

## Rules

1. **No code without an approved spec.** Small fixes may use a one-file "mini spec" (requirements and tasks only) inside an existing spec folder.
2. **Acceptance criteria are testable.** Write them as `AC-n: WHEN <condition> THE SYSTEM SHALL <behaviour>`. Each one maps to a test, an eval case or a named manual check.
3. **Deterministic behaviour is tested. Model behaviour is evaluated.** Schemas, routing, state transitions, memory rules and tool validation get unit tests. Conversation quality, extraction accuracy and plan quality get evals with numeric thresholds in the spec.
4. **Contracts are the source of truth** between Kemi, the web app and the UI. A contract change needs a spec change and a version bump.
5. **Playbooks are specs too.** A playbook change names its eval suite and the threshold it must meet.
6. **Decisions go in ADRs** (`docs/adr/NNNN-title.md`) and are linked from `design.md`. Don't re-argue decided points in specs.
7. **Specs stay current.** If implementation changes the design, update `design.md` in the same pull request.

## Folder per spec

```
specs/050-intake-agent/
├── requirements.md
├── design.md
└── tasks.md
```

Numbering: the tens digit is the phase from [ROADMAP.md](ROADMAP.md); add `051-…` and `052-…` for follow-up specs in the same phase. Copy the files from `_templates/` to start.

## Status values

`Draft` → `In review` → `Approved` → `In progress` → `Done` (or `Superseded by NNN`). The status is the first line under each file's title.

## Working with AI coding agents

Give the agent the spec folder, not a chat description. Ask it to:
1. Read `requirements.md`, `design.md`, `tasks.md` and the linked contracts.
2. Work on the next unchecked task only, writing the test or eval first.
3. Stop and report if a requirement is ambiguous or the design doesn't fit the code, instead of guessing.
