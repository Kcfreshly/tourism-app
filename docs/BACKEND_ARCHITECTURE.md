# Backend architecture

This guide describes the working tree on branch `kemi-agent` as inspected on
2026-11-23, including uncommitted Docker and deployment files. It documents what
is built, not the planned designs (payments, reviews storage, Kemi agents); those
are listed under [Not built yet](#not-built-yet). Start with the component map,
then follow the request flows.

The backend is a **Next.js App Router application with an integrated backend**.
Route handlers, authentication, planning, validation and persistence run in one
process. There is one logical database, reached through Drizzle: PGlite by
default, or PostgreSQL when `DATABASE_URL` is set (PostgreSQL 17 in Docker is
the recommended local setup). **Kemi**, the AI companion, is a second, optional
service in `services/kemi`, reached only through a proxy in the web app. There
are no queues, background workers or scheduled jobs.

## Component map

Arrows show calls or data movement. Boxes inside the web app are code modules,
not separate deployments. The two storage engines are alternatives.

```mermaid
flowchart TD
    Browser["Browser: explore, saved activities, cart, planner, partner portal, admin"]
    Local["Browser localStorage: saved-activities cache, cart, profile draft, active trip"]
    Browser <--> Local

    subgraph App["Next.js application (web)"]
        Pages["Server pages: catalogue reads and page guards"]
        AuthAPI["/api/auth/*: Better Auth"]
        API["/api/v1 route handlers"]
        Health["/api/health"]
        Container["bootstrap/container.ts: wires modules"]
        Guards["Guards: session, role, origin, rate limit"]
        Identity["identity: actors, sessions, guest merge"]
        Catalogue["catalogue: listings, packages, media, recovery"]
        Partners["partners: applications, submissions, dashboard, visits"]
        Trips["trips: intake, planner, proposals, transport settings"]
        Bucket["bucket: saved activities"]
        Bookings["bookings: cart line rules and prices only"]
        KemiBFF["kemi: BFF proxy"]
        DB["Drizzle: database access and transactions"]
        Config["Demo-mode guard"]
    end

    subgraph KemiSvc["Kemi service (optional, Express + AI SDK)"]
        Chat["POST /v1/chat: UI message stream"]
    end

    Browser --> Pages
    Browser --> AuthAPI
    Browser --> API
    API --> Container
    Pages --> Container
    Container --> Guards
    Container --> Identity
    Container --> Catalogue
    Container --> Partners
    Container --> Trips
    Container --> Bucket
    Container --> KemiBFF
    Partners -->|ListingCatalogue port| Catalogue
    Trips -->|OfferCatalogue port| Catalogue
    Bucket -->|PublishedOffers port| Catalogue
    Guards --> DB
    Identity --> DB
    Catalogue --> DB
    Partners --> DB
    Trips --> DB
    Bucket --> DB
    Health --> DB
    KemiBFF -->|KEMI_ENABLED=true| Chat
    Chat --> Anthropic["Anthropic API"]
    Chat --> Langfuse["Langfuse traces"]
    Browser -. "cart preview only" .-> Bookings
    DB --> Config

    DB --> Choice{"DATABASE_URL set?"}
    Choice -->|No| PGlite[("PGlite: .local/demo-db")]
    Choice -->|Yes| PG[("PostgreSQL 17 via postgres.js")]
    Fixtures["Versioned JSON: catalogue, events, pricing, contracts"] --> Trips
    Fixtures --> Bookings
    Fixtures --> Seed["CLI seed"]
    Seed --> DB
    Migrations["CLI migrate: migrations/0001-0009"] --> DB
```

Standalone source: [backend-data-flow.mmd](backend-data-flow.mmd).

## Modules

Code is grouped by module under [`src/modules`](../src/modules), each split into
`domain`, `application` (ports, use cases, services), `infrastructure` and
`presentation`; the rules are in [`src/modules/README.md`](../src/modules/README.md).
[`src/bootstrap/container.ts`](../src/bootstrap/container.ts) is the only place
that creates repositories and hands them to use cases and controllers. Route
files only map HTTP methods to `api.*` controllers; server pages call `pages.*`
directly, without an HTTP round trip. Modules reach each other only through
narrow ports built in the container (`OfferCatalogue`, `PublishedOffers`,
`ListingCatalogue`).

| Module      | Layers built                | Owns                                                                                                                                                 |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`  | all four                    | Better Auth setup, actor and role lookup, request guards, page guards, rate limiter, legacy guest sessions and draft merge                          |
| `catalogue` | all four                    | Experiences (listings), ready-made trips (packages), photo uploads, deletion and restore from the audit trail, publishing approved partner listings |
| `partners`  | all four                    | Partner applications and verification, membership, listing submissions and approval queue, partner dashboard, listing visit counts                  |
| `trips`     | all four                    | Trip profile and intake, planner workspace, proposals, transport and guide settings, trip checkout summary                                         |
| `bucket`    | all four                    | Saved activities per account (the UI calls them "saved activities"; the code and table still say bucket)                                            |
| `kemi`      | application, infra, presentation | Proxy to the Kemi service, behind a flag                                                                                                    |
| `audit`     | infrastructure (schema)     | The `audit_events` table, written by other modules' repositories                                                                                    |
| `bookings`  | domain only                 | Cart line schema and line/fee pricing, used by the browser. No server code                                                                          |
| `reviews`   | domain, application         | Review rules and use cases, tested with in-memory fakes. No tables, repository or routes                                                            |

Shared pieces: [`responses.ts`](../src/shared/presentation/http/responses.ts)
(response envelope and error mapping), [`app-error.ts`](../src/shared/application/app-error.ts),
[`database/client.ts`](../src/database/client.ts) (driver choice, lazy shared
instance), [`database/schema.ts`](../src/database/schema.ts) (re-exports each
module's `infrastructure/persistence/schema.ts`), [`sql-rows.ts`](../src/database/sql-rows.ts)
(normalises raw SQL results across postgres.js and PGlite) and
[`config/environment.ts`](../src/config/environment.ts).

Domain code is shared with the browser for instant feedback. API handlers
re-validate and recalculate prices themselves; browser state is never the
authority, except where noted for the cart.

## Access rules

| Guard                  | Where                                                                          | Rule                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `requireActor()`       | [`request-guards.ts`](../src/modules/identity/presentation/http/request-guards.ts) | Signed-in account, else 401. Resolves the account's current role from `auth_user`.                                       |
| `requireAdmin()`       | same                                                                           | Role `ADMIN` or `SUPER_ADMIN`, else 403.                                                                                     |
| `requireSuperAdmin()`  | same                                                                           | Role `SUPER_ADMIN`; only used to delete listings.                                                                            |
| `PartnerAccess.verified()` | [`partner-access.ts`](../src/modules/partners/application/services/partner-access.ts) | Account is a member of a `VERIFIED` partner, else 403 `NOT_A_PARTNER` / `PARTNER_NOT_VERIFIED`. Every partner query is scoped to that partner's id. |
| Trip ownership         | [`owned-trip.ts`](../src/modules/trips/presentation/http/owned-trip.ts)        | Trip UUID must belong to the actor; otherwise 404, so other users' trips are indistinguishable from missing ones.             |
| `checkOrigin()`        | request guards                                                                 | Every write. `Origin` must be `PUBLIC_APP_URL`, its localhost/127.0.0.1 alias, or the request's own Host.                     |
| `throttle(key, max)`   | request guards → `request_limits`                                              | Per actor and operation, 60-second window, stored in the database so it holds across replicas.                               |
| Page guards            | [`page-guards.ts`](../src/modules/identity/presentation/pages/page-guards.ts)  | `requireSignedIn(next)` redirects to `/account?next=…`. Used by `/checkout`, `/partner`, `/plan/new`, `/trips/**`. `/admin` checks `requireAdmin` itself. |

Page guards are for navigation; the API checks are what protect data. Partner
membership is a separate table, not a role, so one account can be a traveller
and a partner. Public sign-up never sets a role; `scripts/grant-demo-admin.ts`
does, with an audit event.

## API surface

Paths are relative to `/api/v1` unless they start with `/api`. "Origin" means
`checkOrigin()` runs. Limits are requests per actor per 60 seconds.

**Platform and identity**

| Method    | Path              | Access                       | Does                                                                     |
| --------- | ----------------- | ---------------------------- | ------------------------------------------------------------------------ |
| GET, POST | `/api/auth/*`     | Better Auth                  | Sign-up, sign-in, sessions (Better Auth's own protocol, 30 req/60 s)     |
| GET       | `/api/health`     | Public                       | `SELECT 1`; `{status:"ok"}` or 503. Never cached                        |
| DELETE    | `/session`        | Origin                       | Expires the legacy guest session and signs the account out               |
| POST      | `/account/merge`  | Account + origin             | Moves legacy guest **trip drafts** to the account                        |

**Catalogue (public)**

| Method | Path                | Access | Does                                                                         |
| ------ | ------------------- | ------ | ---------------------------------------------------------------------------- |
| GET    | `/experiences`      | Public | Published listings (`DEMO_PUBLISHED`)                                        |
| GET    | `/experiences/{id}` | Public | One published listing by UUID or seed key                                    |
| GET    | `/packages`         | Public | Published ready-made trips                                                   |
| GET    | `/media/{id}`       | Public | Uploaded photo bytes; immutable cache, `nosniff`, sandboxed CSP              |
| POST   | `/views`            | Origin, 120 per visitor | Counts a listing view; staff and partner members aren't counted |

**Traveller**

| Method     | Path                     | Access                             | Does                                                                                   |
| ---------- | ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------- |
| GET, PUT   | `/bucket`                | Account (PUT: origin, 60)          | Saved activities, `{offerIds, expectedVersion}`, max 30; unpublished ids dropped       |
| POST       | `/intake`                | Account + origin, 20               | Text → suggested profile changes; saves nothing                                        |
| GET, POST  | `/trips`                 | Account (POST: origin, 20)         | List owned trips; create one from a profile                                            |
| GET, PATCH, DELETE | `/trips/{id}`    | Owner (writes: origin, 100)        | Read, update profile with `expectedVersion`, delete                                    |
| GET, PUT   | `/trips/{id}/workspace`  | Owner (PUT: origin, 100)           | Items, services and fresh price; versioned save                                        |
| POST       | `/trips/{id}/plan`       | Owner + origin, 10                 | Generate a proposal (15-minute expiry)                                                 |
| POST       | `/trips/{id}/plan/apply` | Owner + origin                     | Apply a proposal atomically                                                            |
| GET, POST  | `/kemi/{...path}`        | Account (POST: origin), 60; `KEMI_ENABLED` | Forwards to Kemi `/v1/...`; 404 `KEMI_DISABLED` when off                       |

**Partner portal**

| Method             | Path                    | Access                          | Does                                                                         |
| ------------------ | ----------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| GET, POST          | `/partner`              | Account (POST: origin, 10)      | Own partner record; apply (creates `PENDING` partner, caller as `OWNER`)     |
| GET                | `/partner/listings`     | Verified partner                | Own live listings and trips, with any open submission                        |
| POST, PATCH, DELETE | `/partner/submissions` | Verified partner + origin (30 / 60 / 60) | Start a draft (new or edit of live), save/submit, withdraw          |
| GET                | `/partner/dashboard`    | Verified partner                | Listing counts by status and views/visitors from `listing_visits`            |
| POST               | `/partner/media`        | Verified partner + origin, 60   | Photo upload, same rules as staff upload                                     |

**Admin**

| Method                  | Path                          | Access                          | Does                                                                                 |
| ----------------------- | ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| GET, POST, PATCH, DELETE | `/admin/catalogue`           | Admin (DELETE: super admin); origin on writes; 15 create / 60 edit / 20 delete | All listings; create draft; versioned edit and review; delete (snapshot kept in audit) |
| GET, POST               | `/admin/catalogue/deleted`    | Admin (POST: origin, 20)        | Deleted listings from the audit trail; restore one                                   |
| GET                     | `/admin/catalogue/history`    | Admin                           | Saved versions of a listing                                                          |
| GET, POST, PATCH        | `/admin/packages`             | Admin; origin on writes; 15 / 60 | Ready-made trips: list, create draft, versioned edit                                |
| POST                    | `/admin/media`                | Admin + origin, 60              | Photo upload (max 5 MB, type checked, deduplicated by SHA-256)                       |
| GET, PATCH              | `/admin/partners`             | Admin (PATCH: origin, 60)       | Partners; verify, decline or suspend with a reason                                   |
| GET, PATCH              | `/admin/submissions`          | Admin (PATCH: origin, 60)       | Pending submissions with the live version; approve (publishes) or decline            |
| GET, PUT                | `/admin/transport-settings`   | Admin (PUT: origin, 30)         | Car, night-car and guide rates and rules the planner reads                           |

Successes are `{ data, meta: { requestId } }` with `Cache-Control: private,
no-store`; failures are `{ error: { code, message }, meta: { requestId } }`.
Typical statuses: 401 unauthenticated, 403 origin/role/partner rejection, 404
missing or not owned, 409 `VERSION_CONFLICT`, 422 invalid input, 429 throttled.
Unhandled errors become a generic 503. Request ids are per response; there is
no tracing or structured logging in the web app.

## Data flow: browse, save and sign in

1. Explore, listing and package pages read the published catalogue through
   `pages.listPublishedExperiences()` / `listPublishedPackages()`; the browser
   also calls `/experiences` and `/packages`.
2. **Saved activities.** Guests keep offer ids in localStorage. Signed in,
   [`use-bucket-sync.ts`](../src/hooks/use-bucket-sync.ts) loads `/bucket`, merges
   the guest list after the account's (`mergeBuckets`, max 30), and saves with
   `expectedVersion`. localStorage stays the cache, with owner and pending keys
   so another account's list is never shown and offline changes are retried.
3. **Cart.** Lines (dated experience or package, party, pickup) live only in
   localStorage (`tourism.cart.v1`, max 20). The cart and `/checkout` review
   pages price them in the browser with `bookings/domain/cart.ts`. No endpoint
   receives the cart, and sign-out clears it. See [CART_END_TO_END.md](CART_END_TO_END.md).
4. Sign-out (`DELETE /session` and `forgetTravellerState()`) clears every
   traveller key in localStorage; saved activities come back from the server at
   the next sign-in.
5. Planning pages require sign-in. Creating a trip validates the profile,
   drops selected offers that are no longer published, and inserts an
   account-owned `trips` row at version 1.

The legacy `sessions` table and `tourism-session` cookie only exist so older
guest trip drafts can be claimed; no new guest sessions are created. The merge
expires the guest session, moves its trips and writes an audit event in one
transaction.

## Data flow: edit and autosave

```mermaid
sequenceDiagram
    actor User
    participant UI as Planner browser
    participant API as Workspace route
    participant Access as Identity and trip access
    participant Rules as Domain validation and pricing
    participant DB as Database

    UI->>API: GET /trips/id/workspace
    API->>Access: Resolve session and owned trip
    Access->>DB: Read account and owned trip
    DB-->>Access: Profile, items, services, version
    API->>DB: Read published catalogue and transport settings
    API->>Rules: assess(profile, items, services, offers)
    Rules-->>API: Lines, totals, blockers, warnings
    API-->>UI: trip, offers, price
    User->>UI: Edit items or services
    UI->>API: PUT items, services, expectedVersion
    API->>Access: Origin, account and ownership checks
    API->>DB: Increment request limit and read catalogue
    API->>Rules: Zod parse, placementIssues, assess
    alt Invalid placement or payload
        API-->>UI: 422 validation error
    else Valid placement
        API->>DB: UPDATE trip WHERE owner and version match
        alt Version matched
            DB-->>API: Saved trip at next version
            API-->>UI: Saved trip and calculated price
        else Another save won
            DB-->>API: No updated row
            API-->>UI: 409 VERSION_CONFLICT
        end
    end
```

`expectedVersion` is optimistic concurrency: a save succeeds only if the stored
version still matches, and increments it. The client reloads after a conflict
rather than overwriting another tab's changes. The same pattern is used for
saved activities, listings, packages, partners, submissions and transport
settings.

`placementIssues()` enforces a subset of assessment blockers: invalid
dates/times, unavailable offers, city/party/duration/opening/session/cutoff/capacity
constraints, duplicates, overlaps, transit and full-day conflicts. Other
blockers, such as a missing accommodation base or service window, can remain
in a saved draft and are returned with the price. A saved draft is not proof
that it is bookable.

## Data flow: generate, preview and apply a plan

```mermaid
sequenceDiagram
    participant UI as Planner browser
    participant API as Plan routes
    participant Engine as Deterministic generator
    participant Rules as Contract and placement validation
    participant DB as Database

    UI->>API: POST /trips/id/plan
    API->>DB: Load owned trip, published offers and throttle counter
    API->>Engine: Profile, retained items, services, offers
    Engine->>Rules: Placement checks and AJV planner contract
    Engine-->>API: Items, services, assumptions, questions
    API->>DB: Insert proposal with trip version and 15-minute expiry
    API-->>UI: Proposal ID, expectedVersion, diff and price
    Note over UI,DB: Preview does not update the saved itinerary
    UI->>API: POST /plan/apply with proposalId and expectedVersion
    API->>DB: Load owned trip and current published offers
    API->>DB: BEGIN transaction
    API->>DB: Claim matching unexpired, unapplied proposal
    API->>Rules: Parse payload, check locked items, contract and placement
    API->>DB: Update owned trip only at expectedVersion
    alt All checks pass
        API->>DB: COMMIT proposal claim and trip update
        API-->>UI: Updated trip and fresh price
    else Expired, consumed, invalid, locked change or version conflict
        API->>DB: ROLLBACK
        API-->>UI: Error; regenerate preview or resolve invalid placement
    end
```

The generator keeps locked items and custom blocks, filters eligible offers by
city, interests and party, prioritises selected offers and the base zone, and
places experiences within available times. It uses fictional zone travel data
and the admin-set transport settings, and validates output against the shared
JSON Schema with AJV. It calls no AI or routing service.

## Data flow: catalogue administration

- **Listings.** Staff create a fictional `DRAFT`, then edit content, rates,
  capacity, schedule, photos and the review checklist. Statuses: `DRAFT`,
  `RESEARCHED`, `DEMO_VERIFIED`, `DEMO_PUBLISHED`, `PAUSED`; only
  `DEMO_PUBLISHED` is public. Verified and published states require the review
  checks. A listing that runs past midnight also needs the night-visit
  security review before it can be verified or published.
- **Packages** (ready-made trips): `DRAFT`, `DEMO_PUBLISHED`, `PAUSED`, with
  departures marked `OPEN`/`LIMITED`/`FULL` (no seat numbers). The slug is fixed
  at creation because cart lines refer to it.
- **Audit and recovery.** Every listing write inserts an `audit_events` row
  with a full snapshot, in the same transaction; package writes are audited
  too. Migration 0008 makes
  `audit_events` append-only with triggers, and refuses drop/alter unless a
  developer sets `app.allow_audit_ddl` in a console. Deleting a listing (super
  admin) leaves its snapshot; admins list deleted listings and restore them, and
  read a listing's version history, from those events.
- **Photos** are stored as `bytea` in `media`, deduplicated by SHA-256, never
  deleted, so a restored listing gets its photos back. The app writes nothing
  to disk.

Existing trips keep offer ids, not snapshots, so a changed or paused listing
affects their next price and assessment.

## Data flow: partner portal

```mermaid
sequenceDiagram
    actor Partner
    actor Staff
    participant API as /partner and /admin routes
    participant P as partners module
    participant C as catalogue module
    participant DB as Database

    Partner->>API: POST /partner (apply)
    API->>P: ApplyAsPartner
    P->>DB: partners PENDING + partner_members OWNER + audit
    Staff->>API: PATCH /admin/partners (verify)
    API->>P: DecidePartner
    P->>DB: status VERIFIED (versioned) + audit
    Partner->>API: POST /partner/submissions, then PATCH to submit
    API->>P: StartSubmission, SaveSubmission (readiness checks)
    P->>DB: listing_submissions DRAFT then PENDING
    Staff->>API: PATCH /admin/submissions (approve)
    API->>P: DecideSubmission
    P->>C: ListingCatalogue.approveExperience / approvePackage
    C->>DB: create or replace live record, partner_id set, audit snapshot
    P->>DB: submission APPROVED + audit
```

The catalogue only ever holds what staff approved. An edit to a live listing
waits as a submission while the live version keeps selling; a unique index
allows one open submission per listing. Approval re-checks that the partner is
still `VERIFIED` and that the submission version hasn't changed since staff
opened it. A listing staff paused stays paused after an approved edit. Details:
[PARTNER_PORTAL.md](PARTNER_PORTAL.md).

## Kemi

Kemi is a separate Node service ([`services/kemi`](../services/kemi), Express 5,
AI SDK 7, Anthropic models, Langfuse tracing over OpenTelemetry). It has
`POST /v1/chat`, which streams the AI SDK UI message stream, and a health
route. The browser never calls it directly: `/api/v1/kemi/*` checks the flag,
session, origin (on POST), rate limit, path segments and a 256 KB body cap,
then forwards with a fresh request id. Cookies and caller headers are not
forwarded, and no user identity is sent yet (ADR 0002 phase 0). Kemi has no
access to app data: the on-behalf-of token and `/internal/kemi/*` tool API in
[KEMI_ARCHITECTURE.md](KEMI_ARCHITECTURE.md) are not built.

## Persistence model

Solid arrows are foreign keys; dotted arrows are links the application enforces.

```mermaid
flowchart LR
    User[("auth_user: identity and role")]
    Session[("auth_session / auth_account / auth_verification")]
    Guest[("sessions: legacy guest token hashes")]
    Trips[("trips: owner, version, profile, items, services")]
    Proposals[("planner_proposals: payload, trip version, expiry, appliedAt")]
    Bucket[("account_buckets: offer_ids, version")]
    Catalogue[("catalogue: status, version, record, review, partner_id")]
    Packages[("packages: slug, status, version, record, partner_id")]
    Media[("media: bytes, sha256, uploaded_by")]
    Transport[("transport_settings: settings, version")]
    Partners[("partners: status, contact, version")]
    Members[("partner_members: role")]
    Subs[("listing_submissions: proposed record, status, version")]
    Visits[("listing_visits: day, visitor, views")]
    Audit[("audit_events: append-only, snapshots")]
    Limits[("request_limits: hashed key, count, resetAt")]
    User -->|user_id FK| Session
    User -->|user_id FK| Bucket
    User -->|user_id FK| Members
    Partners -->|partner_id FK| Members
    Partners -->|partner_id FK| Catalogue
    Partners -->|partner_id FK| Packages
    Partners -->|partner_id FK| Subs
    User -.->|ACCOUNT owner| Trips
    Guest -.->|GUEST owner until merge| Trips
    Trips -->|trip_id FK| Proposals
    Trips -.->|offer ids| Catalogue
    Bucket -.->|offer ids| Catalogue
    Subs -.->|product_id when editing| Catalogue
    Subs -.->|product_id when editing| Packages
    Visits -.->|product id or slug| Catalogue
    Catalogue -.->|photo ids in record| Media
    User -.->|actorId| Audit
```

| Migration | Adds                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 0001      | `catalogue`, `trips`, `sessions` (guest), `migration_history`                                         |
| 0002      | Better Auth tables (`auth_*`, with role), trip owner type, `audit_events`, `request_limits`           |
| 0003      | Catalogue review checklist                                                                             |
| 0004      | `planner_proposals`                                                                                    |
| 0005      | `account_buckets`                                                                                      |
| 0006      | `transport_settings`                                                                                   |
| 0007      | `packages`                                                                                             |
| 0008      | Append-only `audit_events` triggers, starting snapshot of every listing, `media`                      |
| 0009      | `partners`, `partner_members`, `partner_id` on catalogue and packages, `listing_submissions`, `listing_visits` |

Listings, packages, trips and submissions keep the full record in JSONB, with
status, version and owner/partner as columns. Experience database id, seed
key and nested offer id are different identifiers; trips, saved activities and
cart lines refer to the offer id. Money is integer kobo throughout. Prices are
calculated on demand from the catalogue, transport settings and
[`pricing.demo.json`](../tourism-v1-handoff/data/pricing.demo.json) (fee rate);
nothing stores a quote.

## Runtime and deployment

| Setting or tool                     | Effect                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                      | PostgreSQL through postgres.js; empty means PGlite at `LOCAL_DATABASE_PATH` (default `.local/demo-db`, one process only). |
| `npm run db:up`                     | Local PostgreSQL 17 in Docker on `127.0.0.1:5440` ([LOCAL_DATABASE.md](LOCAL_DATABASE.md)).                         |
| `PUBLIC_APP_URL`                    | Auth base URL and origin allowlist; default `http://127.0.0.1:3000`.                                               |
| `AUTH_SECRET`                       | Required in production; demo mode otherwise generates `.local/auth-secret`.                                        |
| `APP_MODE`, `LIVE_CHECKOUT_ENABLED` | `assertDemo()` refuses anything but demo mode and refuses live checkout.                                           |
| `ALLOW_LOCAL_DEMO_BUILD`            | Must be `true` to run under `NODE_ENV=production` (set in Compose).                                               |
| `KEMI_ENABLED`, `KEMI_URL`          | Opens the Kemi proxy only when exactly `true`; default URL `http://127.0.0.1:4100`.                                |
| `PAYMENT_PROVIDER`, `PLANNER_PROVIDER` | Listed in `.env.example` but read by nothing.                                                                   |
| `npm run db:migrate` / `db:seed:demo` / `db:refresh-dates` | Ordered SQL migrations under an advisory lock; fictional seed (AJV-validated, keeps edits); move demo dates forward. |

**Docker** (uncommitted, not yet built or deployed; see [DEPLOYMENT.md](DEPLOYMENT.md)):
`next.config.ts` builds `output: "standalone"`. `docker-compose.prod.yml` runs
`db` (PostgreSQL 17), a one-off `migrate` job, `web` (starts only after
`migrate` succeeds, health-checked on `/api/health`) and, under the `kemi`
profile, `kemi` on the internal network only. The web app is stateless, so it
can be replaced or scaled; rate limits already live in the database.

**Tests.** `npm test` runs Vitest suites in [`tests`](../tests) (domain, components,
partners, reviews use cases, Kemi proxy). `test:modules` runs use cases
against the real database; `test:integration`, `test:admin`, `test:workspace`
and `test:overlays` drive a running app. Multi-process races on PostgreSQL
have not been tested.

## Not built yet

These are boundaries, not components hidden elsewhere:

- **Cart on the server, checkout, payments, bookings.** The cart is browser-only
  and both Pay buttons are disabled. No orders, holds, capacity, Paystack,
  webhooks, refunds or partner payouts. Plans: [CART_END_TO_END.md](CART_END_TO_END.md),
  [PAYMENT_INTEGRATION_PLAN.md](PAYMENT_INTEGRATION_PLAN.md).
- **Trip checkout** (`/trips/{id}/checkout`) shows calculated costs and
  readiness only; `inventoryHeld` is always false.
- **Reviews**: domain and use cases only; no tables, routes or UI wiring
  ([REVIEWS_PLAN.md](REVIEWS_PLAN.md)).
- **Kemi** tools, memory and user identity ([KEMI_ARCHITECTURE.md](KEMI_ARCHITECTURE.md)).
- **Background jobs** of any kind (hold expiry, reconciliation, completing
  bookings), email or WhatsApp delivery, supplier connections, live maps or
  traffic.
- Email verification is stored by Better Auth but not required.
- Production review of proxy and Host handling for `checkOrigin()`.

## Maintaining this guide

Update it when changing routes, access rules, tables, pricing authority or
provider integrations, and keep [backend-data-flow.mmd](backend-data-flow.mmd) in
step with the first diagram. The sources of truth are
[`src/app/api`](../src/app/api), [`src/bootstrap/container.ts`](../src/bootstrap/container.ts),
[`src/modules`](../src/modules), [`migrations`](../migrations) and
[`scripts`](../scripts). The handoff specifications describe planned behaviour
and may differ from the running app.
