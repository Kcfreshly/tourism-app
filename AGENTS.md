<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## UI formatting and journey changes

Read and apply [skills/ui-formatting/SKILL.md](skills/ui-formatting/SKILL.md) when changing this application's user journey, forms, cards, dialogs, navigation or responsive layout. Review scrolling containers and the final reachable list item. Formatting tools do not replace visual review; report when browser verification is unavailable.

<!-- skill-ref:app-security:start -->
## Security skill (app-security)

Before every task in this repo, check whether it touches authentication,
authorization, sessions, payments, user input, file uploads, exposed APIs,
CORS, rate limiting, secrets, dependencies or deployment settings. If it does,
load the `app-security` skill (`~/.claude/skills/app-security/SKILL.md`;
agents without a skill tool read that file) before writing or reviewing the
code, and follow it. Security reviews and vulnerability fixes always use it.
If the task touches none of these, carry on without it.
<!-- skill-ref:app-security:end -->
