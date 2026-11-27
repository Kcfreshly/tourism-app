# NNN — <Spec title>: tasks

Status: Draft
Implements: [requirements.md](requirements.md) · [design.md](design.md)

Work top to bottom. Write the test or eval case before the code. Every acceptance criterion must appear in at least one task.

- [ ] 1. <Contract / schema> — covers AC-1
  - [ ] Test: <failing test name>
- [ ] 2. <Domain rule> — covers AC-1, AC-2
  - [ ] Test: <...>
- [ ] 3. <Use case / adapter> — covers AC-2
  - [ ] Test: <...>
- [ ] 4. <Eval cases added to evals/datasets/...> — covers <threshold>
- [ ] 5. Verify: typecheck, lint, tests, eval thresholds; save the report to `evals/reports/`
- [ ] 6. Close: update `design.md` with any drift; set every file's status to Done

## Acceptance criteria coverage

| AC   | Tasks | Verified by             |
| ---- | ----- | ----------------------- |
| AC-1 | 1, 2  | `tests/unit/...`        |
| AC-2 | 2, 3  | `tests/integration/...` |
