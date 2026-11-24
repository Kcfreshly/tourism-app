# Local database: PostgreSQL in Docker

Local development uses the same PostgreSQL 17 that production will use, in a
Docker container. The app still runs on your machine with `npm run dev`; only
the database is containerised. Set up 2026-11-22.

## How it fits together

| Piece           | Where                                                            |
| --------------- | ---------------------------------------------------------------- |
| Container       | `tourism-postgres` (`docker-compose.yml`, project `tourism-app`) |
| Address         | `127.0.0.1:5440` (this machine only)                             |
| Database / user | `fastlife` / `fastlife`, password `fastlife-dev` (local only)    |
| Data            | Docker volume `tourism-app_tourism-pg-data`                      |
| App setting     | `DATABASE_URL` in `.env.local` (not committed)                   |

`src/database/client.ts` uses PostgreSQL whenever `DATABASE_URL` is set, and
the embedded PGlite database in `.local/demo-db` otherwise. `npm run dev` reads
`.env.local` itself; the `db:*` and `demo:grant-admin` scripts load it with
`tsx --env-file-if-exists=.env.local`.

Port 5440 avoids the other projects' containers on this machine (5432–5434).

## Daily use

```sh
npm run db:up          # start the database (waits until healthy)
npm run dev
```

The container restarts with Docker Desktop, and the data stays in the volume.

## Common tasks

```sh
npm run db:migrate                         # apply new migrations
npm run db:seed:demo                       # (re)load demo listings; keeps edits
npm run demo:grant-admin -- you@example.test   # staff access (sign up first)
docker compose down                        # stop the database
docker compose down -v                     # stop and DELETE all local data
docker exec -it tourism-postgres psql -U fastlife   # SQL shell
```

Unlike PGlite, PostgreSQL accepts several connections, so migrations and
scripts no longer need the dev server stopped.

## Going back to PGlite

Remove the `DATABASE_URL` line from `.env.local` and restart `npm run dev`. The
old data in `.local/demo-db` is untouched.

## What did not move

The Docker database was created fresh: migrations 0001–0009 plus the demo seed.
Accounts, saved activities, trips and admin edits made in `.local/demo-db`
(for example the club night's opening hours) are not in it. Sign up again,
grant admin, and redo any listing edits you need.

## The audit table is protected

Since migration 0008, `audit_events` can only be added to and read. Updates,
deletes, truncating, dropping or altering it are refused by the database
itself. To change it from a developer console, run
`SET app.allow_audit_ddl = 'on';` in that session first. See
[ADMIN_PANEL.md](ADMIN_PANEL.md#audit-trail-deleting-and-restoring).

## PGlite (the fallback without `DATABASE_URL`)

Without `DATABASE_URL`, the app stores data in an embedded PGlite database at
`.local/demo-db` (or `LOCAL_DATABASE_PATH`). Only one process may open it. If a
second process (a script, a test or another server) writes to it at the same
time, the files are corrupted, and every later open fails with
`RuntimeError: Aborted()`.

### The lock

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

### Recovering a damaged database

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

### Keeping a backup

With the server stopped, copy the folder:
`Copy-Item .local\demo-db .local\demo-db-backup-YYYYMMDD -Recurse`.
