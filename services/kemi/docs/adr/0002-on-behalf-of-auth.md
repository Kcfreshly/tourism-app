# 0002 — The web app calls Kemi with short-lived on-behalf-of tokens

Status: Accepted, 2026-11-09 (implemented in Phase 1)

## Context

Kemi acts for one signed-in traveller at a time and must never reach another traveller's data, even if a prompt tries to make it.

## Decision

- The BFF checks the session, origin and rate limits, then mints a JWT (about 5 minutes) with `sub` (user ID), optional `tripId`, `scopes` (for example `profile:write`, `plan:propose`, `bucket:write`), `jti` and the request ID.
- Kemi verifies it with `jose` on every route and checks scopes per route and per tool. Kemi presents the same token when it calls the web app's `/internal/kemi/*` tool API, and the web app re-checks ownership.
- Signing key: a shared secret (HS256) in development; an asymmetric key pair (EdDSA) with rotation in production. Service traffic stays on the private network.

## Phase 0

No user data crosses the BFF yet, so Phase 0 forwards only a request ID and `traceparent` and strips cookies and authorization headers. Phase 1 adds the token before any user-scoped route exists.

## Consequences

- Kemi holds no long-lived credentials for app data.
- Tokens expire mid-stream for very long turns; the BFF mints per request and turns are capped well under 5 minutes.
