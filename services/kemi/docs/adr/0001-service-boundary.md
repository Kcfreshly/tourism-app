# 0001 — Kemi is a separate service with its own database

Status: Accepted, 2026-11-09

## Context

Kemi runs long, streamed, model-bound requests and background jobs. The web app is the system of record for accounts, trips, the catalogue, prices and the bucket. The roadmap left open whether Kemi uses its own Postgres or a schema on the app's cluster.

## Decision

- Kemi is its own Node service (`services/kemi`), deployable and scalable apart from the web app.
- The browser never calls Kemi. The web app's `/api/v1/kemi/*` BFF route is the only public entry point.
- Kemi never reads or writes the web app's database. It reaches app data only through the web app's internal tool API (`modules/ona-client`, Phase 1).
- Kemi owns a separate database (`kemi`), with all tables in the `kemi` Postgres schema. Locally it runs in its own container. In production it may share a managed cluster with the app, but as a separate database and role.

## Consequences

- Model latency and load don't affect page rendering or bookings.
- Losing Kemi's database loses conversations and memory only, never trips or payments.
- Every app-data read costs an HTTP call; the tool API must be designed for that.
- The folder can move to its own repository unchanged.
