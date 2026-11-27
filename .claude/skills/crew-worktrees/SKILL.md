---
name: crew-worktrees
description: Use whenever several agents (crew mates) may work on this repo at once, or when starting any coding task as one of them. Each agent works in its own git worktree on its own branch, then rebases onto the branch it started from and lands its work there, merging sensibly with whatever other agents landed in the meantime.
---

# Crew worktrees

Several agents can work on this repo at the same time. To avoid stepping on
each other, **no agent edits the main checkout directly**. Each one gets a
worktree, works there, and at the end rebases onto the branch it came from.

Committing inside your own crew branch is part of this workflow and is allowed.
Landing on the base branch (step 4) is also allowed, because that is the
point of the skill. Pushing to a remote, opening PRs or force-pushing shared
branches still need the user to ask.

## 1. Start: record the base and make a worktree

From the main checkout, before you change anything:

```sh
MAIN=$(git rev-parse --show-toplevel)       # the main checkout
BASE=$(git branch --show-current)           # the branch you were given, e.g. kemi-agent
BASE_SHA=$(git rev-parse HEAD)              # where you started
TASK=<short-kebab-name>                     # e.g. partner-invites
WT="$MAIN/.claude/worktrees/$TASK"
git worktree add "$WT" -b "crew/$TASK" "$BASE"
```

- Use the `EnterWorktree` tool if it is available. It does the same job and
  moves the session into the worktree. Otherwise `cd` into the new folder and
  use absolute paths from then on.
- Write down `BASE`, `BASE_SHA`, `TASK` and `WT` at the top of your plan or todo
  list. You need them at the end, and context can be summarised away.
- If `crew/$TASK` or the folder already exists, another agent may own it.
  Pick a different name. Do not reuse or delete it.
- Uncommitted changes in the main checkout belong to the user or to another
  agent. They are **not** in your worktree. If your task depends on them,
  stop and ask. Do not copy them across yourself.

### Setting up the worktree

**node_modules: link, don't install.** Every worktree shares the main
checkout's `node_modules` through a Windows directory junction (no admin
rights needed):

```powershell
cmd /c mklink /J "$WT\node_modules" "$MAIN\node_modules"
```

- `tsc`, `eslint`, `vitest` and `tsx` scripts work through the link as they
  are.
- `next dev` and `next build` work because `next.config.ts` detects the link
  and sets Turbopack's root to the main checkout, which contains both the
  worktree and the packages. If you see "Could not find the Next.js
  package", the worktree's branch is older than that config. Rebase it onto
  the base first.
- `.gitignore` ignores `node_modules` (link or folder) and
  `.claude/worktrees/`, so neither gets committed.

**Adding, removing or upgrading a dependency.** Never run `npm install`
through the link, because it would change the packages every other agent and
the user are running. Instead:

1. Unlink first with `cmd /c rmdir "$WT\node_modules"`. That deletes only the
   link. Never use `rm -rf` or `Remove-Item -Recurse` on a link, because they
   can follow it and delete the main checkout's packages.
2. Run `npm install <pkg>` in the worktree. It now has its own
   `node_modules`, and the Turbopack root goes back to normal automatically.
3. After landing (step 4), tell the user to run `npm install` in the main
   checkout so the shared copy catches up.

**Environment.** Copy `.env.local` from the main checkout. It is not tracked.

**Database.** Local development uses the PostgreSQL container from
`docker-compose.yml` (`tourism-postgres`, port 5440, database `fastlife`),
which all checkouts share.

- **Your task adds or changes a migration, or rewrites seed data:** give the
  worktree its own database in the same container so unlanded schema never
  touches the shared one:
  ```powershell
  docker exec tourism-postgres createdb -U fastlife fastlife_<task_with_underscores>
  # in the worktree's .env.local: ...@127.0.0.1:5440/fastlife_<task_with_underscores>
  npm run db:migrate; npm run db:seed:demo
  ```
- **No schema or seed changes:** you may use the shared `fastlife`
  database. Don't run `db:migrate` against it from the worktree, and don't
  delete or mass-edit rows other people rely on.
- Never run `docker compose down -v`. That wipes everyone's data.

**Dev server.** If you start `npm run dev`, use a free port
(`npm run dev -- --port 3001` and up). Port 3000 is usually the user's.

## 2. Work

- Commit in small, coherent steps with clear messages. Each commit is
  something another agent may have to read when resolving a conflict.
- Keep to your task. Changes you didn't need are where conflicts come from.
- Follow AGENTS.md as usual (Next.js docs, UI formatting skill, docs/*.md).

## 3. Finish: rebase onto the base branch

When the work is done and checks pass in the worktree:

```sh
git status                                  # everything committed?
git log --oneline "$BASE_SHA..$BASE"        # what landed on the base while you worked
git rebase "$BASE"
```

If `$BASE_SHA..$BASE` is empty, nobody else landed anything and the rebase is
a no-op. Otherwise, other agents' work is now underneath yours.

### When the rebase stops on a conflict

Your job is to produce a result that keeps **both** agents' intent. Do not
pick a side with `--ours` or `--theirs` to make the conflict go away.

1. Understand the other change before touching it:
   ```sh
   git log -p "$BASE_SHA..$BASE" -- <file>      # what they changed and why
   git diff --name-only "$BASE_SHA..$BASE"      # what else they touched
   ```
   Read their commit messages and any docs they updated.
2. Decide what the combined code should be:
   - **Both add things** (routes, container entries, exports, CSS, tests):
     keep both.
   - **Both change the same logic**: write the version that does what both
     needed. If they truly contradict each other, the work already on the
     base wins by default. Adapt yours to it and mention it in your report.
   - **They renamed or moved something you use**: update your code to the
     new name or location. Don't bring back the old one.
   - **They deleted something you changed**: find out why. If the deletion
     was deliberate, move your change to where the logic now lives, or drop
     it and say so.
3. `git add <files>` then `git rebase --continue`. Repeat for each commit.
4. If you can't tell what the other agent meant, or the merge would change
   behaviour the user cares about, run `git rebase --abort` and ask the
   user. Explain both sides.

### Conflicts specific to this repo

- **Migration numbers** (`migrations/NNNN_*.sql`): if another agent took
  your number, renumber **your** migration to the next free one. Update any
  references to it in docs or plans. Never edit a migration that already
  landed on the base.
- **`package-lock.json`**: don't hand-merge it. Take the base's version,
  run `npm install` to add your dependencies again, and commit the result.
  Only do this in a worktree with its own `node_modules`, never through the
  link (see "Adding, removing or upgrading a dependency").
- **`src/bootstrap/container.ts`, `src/database/schema.ts`, route
  folders**: usually both additions. Keep both.
- **Docs (`docs/*.md`)**: merge the text so both agents' sections read as
  one document.

### After the rebase: check again

Someone else's code is now combined with yours, so earlier checks don't
count. In the worktree:

```sh
npm run typecheck
npm run lint
npm test                    # at least the test files you and the other agent touched
```

Fix anything the combination broke, in a new commit. If a failure is in the
other agent's work and unrelated to yours, don't fix it silently. Report it.

## 4. Land on the base branch

The base branch is checked out in the main checkout, so land from there, and
only as a fast-forward:

```sh
git -C "$MAIN" merge --ff-only "crew/$TASK"
```

- **"Not possible to fast-forward"**: another agent landed while you were
  checking. Go back to step 3 and rebase again.
- **"Your local changes would be overwritten"**: the main checkout has
  uncommitted edits to files you changed. They belong to the user or another
  agent. Don't stash, reset or check them out. Stop and tell the user which
  files are affected.
- Never use `git reset`, `git update-ref` or `push --force` to move the
  base branch.

## 5. Clean up

Once the fast-forward succeeded:

```powershell
cmd /c rmdir "$WT\node_modules"             # unlink FIRST: removes only the link
git worktree remove "$WT"
git branch -d "crew/$TASK"                  # -d, not -D: fails if not fully landed
docker exec tourism-postgres dropdb -U fastlife fastlife_<task>   # only if you made one
```

Always remove the `node_modules` link with `rmdir` before removing the
worktree, so nothing can delete through it into the main checkout's
packages. Stop any dev server you started in the worktree first, or Windows
will refuse to remove the folder. Leave other agents' worktrees alone (`git worktree
list` shows them).

## 6. Report

Tell the user:

- the base branch and the commits you landed (`git log --oneline
  $BASE_SHA..$BASE`)
- whether other agents' work was underneath, and for each conflict how you
  combined it
- any migration you renumbered
- check results after the rebase, including failures you did not fix
- anything you were unsure about
