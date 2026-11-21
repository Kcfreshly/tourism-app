# Local database

Without `DATABASE_URL`, the app stores data in an embedded PGlite database at
`.local/demo-db` (or `LOCAL_DATABASE_PATH`). Only one process may open it. If a
second process (a script, a test or another server) writes to it at the same
time, the files are corrupted, and every later open fails with
`RuntimeError: Aborted()`.

## The lock

`src/database/client.ts` writes the owning process id to `.local/demo-db.lock`
when the database opens. Any other process that tries to open it stops with:

> The local database .local/demo-db is open in another process (pid …),
> usually the dev server. Stop it before running database scripts.

The lock is removed when the process exits normally. A lock left behind after
Ctrl+C or a crash is taken over automatically once its process has gone. If
Windows reuses that process id for another program, delete the `.lock` file by
hand.

Stop `npm run dev` before running any of these:

- `npm run db:migrate`
- `npm run db:seed:demo`
- `npm run db:refresh-dates`
- `npm run demo:grant-admin`
- `npm run test:modules`

## Recovering a damaged database

Run in PowerShell from the project folder.

1. Stop the dev server (Ctrl+C), then check nothing is listening on port 3000:
   `netstat -ano | findstr ":3000"`.
2. Move the damaged database aside. Don't delete it.
   `Rename-Item .local\demo-db demo-db-damaged-YYYYMMDD`
   Then remove any leftover lock:
   `Remove-Item .local\demo-db.lock -ErrorAction SilentlyContinue`.
3. Choose one:
   - **Restore a snapshot.** `Copy-Item .local\verify-db .local\demo-db -Recurse`,
     then `Remove-Item .local\demo-db\postmaster.pid -ErrorAction SilentlyContinue`.
   - **Start empty.** Skip this step.
4. `npm run db:migrate`. Already applied migrations are skipped.
5. `npm run db:seed:demo`. This adds missing demo listings and keeps existing
   edits.
6. `npm run dev`, then sign up at `/account` if your account doesn't exist yet.
7. Stop the server, then run `npm run demo:grant-admin -- you@example.com`.
8. `npm run dev` again, sign in and open `/admin`.

## Keeping a backup

With the server stopped, copy the folder:
`Copy-Item .local\demo-db .local\demo-db-backup-YYYYMMDD -Recurse`.
