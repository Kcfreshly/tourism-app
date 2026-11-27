# Deploying with Docker

Status: images and `docker-compose.prod.yml` written 2026-11-22 (not deployed;
local development uses only the database, see docs/LOCAL_DATABASE.md). The
standalone production build and `/api/health` were verified on the host; the
images themselves have not been built yet.

## What runs

| Service   | Image                                | Role                                                                                    |
| --------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `db`      | `postgres:17-alpine`                 | The database. Data lives in the `db-data` volume.                                       |
| `migrate` | `Dockerfile`, target `migrate`       | Applies `migrations/*.sql` (and the demo seed when `SEED_DEMO=true`), then exits.       |
| `web`     | `Dockerfile`, target `web`           | Next.js standalone server on port 3000, non-root, health-checked on `/api/health`.      |
| `kemi`    | `services/kemi/Dockerfile` (profile) | Optional AI companion, reachable only inside the Compose network at `http://kemi:4100`. |

`web` starts only after `migrate` finishes successfully, so a deploy never runs
new code against an old schema. The app keeps no files on disk: uploaded photos
are stored in PostgreSQL (`media` table), so `web` can be replaced or scaled
freely. The embedded PGlite database (`.local/demo-db`) is for local development
only and is never used when `DATABASE_URL` is set.

## First deploy

```sh
cp .env.production.example .env     # fill in every value
openssl rand -base64 48             # use as AUTH_SECRET
docker compose -f docker-compose.prod.yml up -d --build   # add --profile kemi for Kemi
docker compose -f docker-compose.prod.yml logs migrate    # "Database migrations up to date."
curl http://localhost:3000/api/health
```

Put a TLS-terminating proxy (Caddy, nginx, a load balancer) in front of port
`WEB_PORT`, and set `PUBLIC_APP_URL` to the public `https://` address: sign-in
and origin checks reject other origins.

Then create the first staff account: sign up in the app, and run
`docker compose -f docker-compose.prod.yml run --rm migrate npx tsx scripts/grant-demo-admin.ts <email>`.

## Updating

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrate reruns; applied files are skipped
```

## Moving existing local data

The local demo lives in PGlite (`.local/demo-db`) and is not copied
automatically. The simple path is to reseed the new database
(`SEED_DEMO=true`): listings come back, but accounts, saved activities and trips
created locally do not. Copying those needs a one-off export script from PGlite
into PostgreSQL, which has not been written or tested yet.

## Settings that matter

- **`ALLOW_LOCAL_DEMO_BUILD=true`** is set in Compose. `assertDemo()`
  (`src/config/environment.ts`) refuses to run under `NODE_ENV=production`
  without it, because only the fictional demo is built: checkout stays disabled.
  Remove the flag and that guard together when live payments ship
  (docs/PAYMENT_INTEGRATION_PLAN.md).
- **`AUTH_SECRET`** is required. Without it the app would write a random secret
  inside the container, and every redeploy would sign everyone out.
- **Rate limits** use the `request_limits` table, so they hold across several
  `web` replicas.

## Managed hosting

The same `web` and `migrate` images work on any container host (Fly.io, Render,
Railway, ECS, Cloud Run) with a managed PostgreSQL: set `DATABASE_URL` and the
`web` settings above, and run the `migrate` image as a release/pre-deploy job.

## Not yet verified

- Building and running the images (`docker-compose.prod.yml`).
- The app under load on PostgreSQL. Migrations and the seed do run cleanly on
  PostgreSQL 17 (local Docker database, 2026-11-22). Concurrent checkouts
  are tested on PostgreSQL with many connections (`npm run test:postgres`,
  2026-11-26); load testing the whole app is still to do.
- Backups: schedule `pg_dump` of the `db` volume (or use the managed provider's
  backups) before real users arrive.
