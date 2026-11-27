# Architecture

How the frontend reaches the backend, what each folder holds, and how the
Kemi AI service fits in. For deeper detail see
[BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md),
[KEMI_ARCHITECTURE.md](KEMI_ARCHITECTURE.md),
[backend-data-flow.mmd](backend-data-flow.mmd) and
[src/modules/README.md](../src/modules/README.md).

## 1. Overview

The app is a single Next.js 16 application that serves both the frontend and
the backend. One separate service, Kemi (the AI assistant), sits behind it.

```
┌──────────────────────────── Browser ────────────────────────────┐
│  src/app/**/page.tsx  ──renders──▶  src/components/*.tsx        │
│                                     src/hooks/*.ts              │
│                    fetch("/api/v1/...")  │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           ▼
┌──────────────────── Next.js server (same app) ──────────────────┐
│  src/app/api/v1/**/route.ts      ← thin: GET = api.trips.list   │
│              │                                                  │
│  src/bootstrap/container.ts      ← composition root, wires all  │
│              │                                                  │
│  src/modules/<area>/                                            │
│     presentation/   controller: origin check, auth, throttle,   │
│                     validate body, call ONE use case            │
│     application/    use cases + ports (interfaces)              │
│     domain/         pure business rules and types (Zod)         │
│     infrastructure/ Drizzle repositories, Better Auth           │
│              │                                                  │
│  src/database/client.ts  → PGlite (local) or Postgres (URL)     │
└──────────────┼──────────────────────────────────────────────────┘
               │  /api/v1/kemi/* (only when KEMI_ENABLED=true)
               ▼
┌──────────── services/kemi (separate Express app, :4100) ────────┐
│  routes/chat.ts → agents/kemi.ts (AI SDK) → ai/models.ts        │
│  streams SSE back; LLM traces go to Langfuse                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. One request end to end: creating a trip

| Step | File                                                                        | What happens                                                                                                     |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | `src/components/my-trips.tsx`                                               | Browser calls `fetch("/api/v1/trips", { method: "POST" })`                                                       |
| 2    | `src/app/api/v1/trips/route.ts`                                             | One line: `export const POST = api.trips.create`                                                                 |
| 3    | `src/bootstrap/container.ts`                                                | Built `api.trips.create` from the controller, `CreateTrip` and `DrizzleTripRepository(db)`                       |
| 4    | `src/modules/trips/presentation/http/controllers/create-trip-controller.ts` | `checkOrigin()` → parse with `profileSchema` → `requireActor()` → `throttle` → run the use case                  |
| 5    | `src/modules/trips/application/use-cases/create-trip.ts`                    | Business logic: drops unpublished offers, builds the trip                                                        |
| 6    | `src/modules/trips/application/ports/trip-repository.ts`                    | The interface the use case depends on; it never sees Drizzle                                                     |
| 7    | `src/modules/trips/infrastructure/persistence/drizzle-trip-repository.ts`   | The SQL, through Drizzle                                                                                         |
| 8    | `src/shared/presentation/http/responses.ts`                                 | Wraps the result as `{ data, meta: { requestId } }`, or an `AppError` as `{ error: { code, message } }` + status |

Error kinds map to statuses in one place: `INVALID` 422, `UNAUTHENTICATED`
401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429,
anything unexpected 503.

Server-rendered pages skip HTTP. For example, `src/app/trips/page.tsx` calls
`pages.requireSignedIn()` from the container directly.

### The `api` object in `container.ts`

`api` is a plain object: **area → action → route handler**. Every leaf is a
function with the signature Next.js expects of a route export,
`(request: Request, context?) => Promise<Response>`, so a route file can
export it as is:

```ts
// src/app/api/v1/admin/catalogue/route.ts
export const GET = api.adminCatalogue.list;
export const POST = api.adminCatalogue.create;
```

The keys are names for people, not URLs. `adminCatalogue.deleted` serves
`/api/v1/admin/catalogue/deleted`, but only because that route file says so.
The URL comes from the folder, the method from the export name.

Each leaf is built in three layers, from the inside out:

```ts
restore: createRestoreCatalogueRecordController(   // 3. HTTP: guards, parse, respond
  guards,                                          //    shared checks, built once
  new RestoreCatalogueRecord(                      // 2. use case: the business rule
    catalogueRepository,                           // 1. infrastructure: Drizzle, built once
  ),
),
```

1. **Repository** (`new DrizzleCatalogueRepository(db)`, near the top of the
   file). Created once and shared by every use case that needs it. `db` is
   lazy, so nothing connects until the first request.
2. **Use case** (`new RestoreCatalogueRecord(repo)`). A class with one
   `execute()` method. It receives its dependencies through the constructor
   (the ports it declares), so tests can pass in fakes.
3. **Controller factory** (`createXController(guards, useCase)`). A function
   that takes its dependencies and returns the handler. The handler runs the
   HTTP-only steps, in order: `checkOrigin()` on writes, then
   `requireActor()` / `requireAdmin()`, `throttle()`, request parsing with
   Zod, `useCase.execute()`, then `success(data)`. It is wrapped in
   `controller()` from `responses.ts`, which turns any thrown `AppError` into
   the `{ error: { code, message } }` envelope and its status code.

Some controllers take no `guards` because they are public. For example,
`experiences.list` gets only the use case. A few take extra arguments: the
partner photo upload is the staff upload controller with a different
`authorize` function.

### The patterns, by name

`container.ts` is a **composition root** using **manual dependency
injection** (no DI framework). The pieces have standard names:

| In the code                                                       | Pattern                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| The whole file; the only place `new Drizzle...` appears           | Composition root                           |
| `new CreateTrip(tripRepository)`                                  | Constructor injection                      |
| `createXController(guards, useCase)` returning a handler          | Factory function (injection via closure)   |
| Use cases with one `execute()`                                    | Use case / interactor (Clean Architecture) |
| `OfferCatalogue`, `ListingCatalogue` interfaces in `application/` | Ports (hexagonal, ports and adapters)      |
| `Drizzle*Repository`, and the inline objects below                | Adapters                                   |
| `controller()` wrapping each handler                              | Decorator (cross-cutting error mapping)    |
| `catalogueRepository`, `guards` built once and reused             | Shared instances (singletons by scope)     |

**Narrow views between modules.** Some modules need another module's data.
The consuming module declares the smallest port it needs, and the container
fills it with a small inline adapter:

```ts
// trips only needs "list what's published", not the catalogue repository
const offers: OfferCatalogue = { listPublished: () => listPublished.execute() };

// partners need their own listings, shaped as LiveListing
const listingCatalogue: ListingCatalogue = {
  owned(partnerId) { ... },        // reads catalogue + package repositories
  find(productType, productId) { ... },
  approveExperience: (command) => publishPartnerExperience.execute(command),
  approvePackage: (command) => publishPartnerPackage.execute(command),
};
```

`liveExperience()` and `livePackage()` are mappers: they translate catalogue
and package records into the partner module's own `LiveListing` type, so
`partners` never imports `catalogue` types (a light anti-corruption layer).
This is interface segregation in practice: each consumer sees only the methods
it uses, and the module boundary is enforced by the container, not by
convention.

Two things to know about the current adapters:

- `listingCatalogue.find()` and `owned()` load every row with `listAll()` and
  filter in memory. Fine at today's catalogue size; add `findById` /
  `listByPartner` to the repositories before it grows.
- `(r.record as Experience)` is a type cast, not a check. It relies on
  `catalogueRepository` only ever holding experiences.

### `auth: authController`, the exception

`api.auth` is not built from a factory, a use case or `guards`. It is a plain
function
([`auth-controller.ts`](../src/modules/identity/presentation/http/controllers/auth-controller.ts))
that hands the whole request to Better Auth:

```ts
export function authController(request: Request) {
  return auth().handler(request);
}
```

- **Route.** `src/app/api/auth/[...all]/route.ts` exports it as both `GET` and
  `POST`. The catch-all sends every `/api/auth/*` path (sign-up, sign-in,
  sign-out, get-session, ...) to Better Auth, which does its own routing.
- **`auth()`** ([`better-auth.ts`](../src/modules/identity/infrastructure/auth/better-auth.ts))
  creates the Better Auth instance on first use and caches it on
  `globalThis`, so dev-server reloads don't create a new one. The config:
  email and password (8+ characters, no email verification), the Drizzle
  adapter on our database, UUID ids, a `role` field that sign-up can't set
  (`input: false`, default `CUSTOMER`), 7-day sessions, its own rate limit
  (30 requests per 60 seconds), and `trustedOrigins` from the same allowlist
  as `checkOrigin()`.
- **Its own format.** Responses are Better Auth's, not our
  `{ data, meta }` envelope. Errors don't go through `AppError`, and requests
  don't use our `request_limits` throttle.
- **How the rest of the app uses auth.** Not through `api.auth`. The
  container creates `BetterAuthSessionReader`, which `ResolveActor` uses to
  turn the session cookie into an `Actor` (id plus role from `auth_user`).
  `guards.requireActor()` calls that. So `api.auth` is the browser's door
  for signing in, and the session reader is how every other controller finds
  out who signed in.

## 3. Folder map

### Frontend

| Folder            | Holds                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`        | Routes. Each `page.tsx` is a screen (`explore`, `plan/new`, `trips/[id]/plan`, `checkout`, `admin`, ...); `*.css` holds tokens and styles |
| `src/components/` | UI pieces (`planner`, `intake`, `bucket`, `checkout`, `whats-on`, ...). These make the `fetch` calls                                      |
| `src/hooks/`      | Client state and sync (`use-bucket-sync`, `use-active-trip`, `use-sign-out`, ...)                                                         |
| `public/`         | Fonts, photos and photo credits                                                                                                           |

### Backend (inside Next.js)

| Folder                       | Holds                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/api/v1/**/route.ts` | The HTTP surface. Maps methods to controllers, nothing else                               |
| `src/bootstrap/container.ts` | Composition root: the only file that creates concrete classes and wires them together     |
| `src/modules/<area>/`        | Business areas, each split into `domain`, `application`, `infrastructure`, `presentation` |
| `src/shared/`                | `AppError` and the HTTP response envelope                                                 |
| `src/database/`              | Lazy Drizzle client (PGlite locally, Postgres when `DATABASE_URL` is set) and schema      |
| `src/config/`                | Environment checks: demo-only guard, allowed origins, Kemi settings                       |
| `migrations/`                | SQL migrations, applied with `npm run db:migrate`                                         |

### Modules

| Module      | Owns                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `identity`  | Accounts, sessions, roles, legacy guest drafts, origin checks, throttling |
| `catalogue` | Experiences, events, photos, admin review and publishing                  |
| `trips`     | Trip profile, intake, planner workspace, proposals, pricing               |
| `bucket`    | Saved activities per account                                              |
| `audit`     | Audit event table, written by other modules inside their transactions     |
| `kemi`      | BFF proxy to the Kemi service, behind `KEMI_ENABLED`                      |

**Naming: Bucket (code) = Saved activities (UI).** Code, storage keys
(`tourism.bucket.v1`) and the `account_buckets` table say "bucket"; travellers
only ever see "saved activities". Explore's address uses `?view=saved` and still
accepts the older `?view=bucket` (`isSavedView` in
`modules/catalogue/domain/explore-link.ts`). Keep new UI copy on "saved
activities"; rename code only as a separate refactor.

### Layers inside a module

| Layer             | Contains                                              | May import                 |
| ----------------- | ----------------------------------------------------- | -------------------------- |
| `domain/`         | Business rules and types                              | Plain libraries (Zod, AJV) |
| `application/`    | `use-cases/`, `ports/` (interfaces), `services/`      | `domain`                   |
| `infrastructure/` | Drizzle repositories and tables, Better Auth          | `application`, `domain`    |
| `presentation/`   | Controllers, request schemas, request and page guards | `application`, `domain`    |

```
presentation -> application -> domain
infrastructure -> application/domain
```

`npm run lint` enforces this. Domain and application code never import Next.js,
Drizzle, Better Auth or the container, so modules can move to a separate API
later without rewriting business logic. Browser components and hooks may
import module `domain` code only, which lets forms validate as the user types.

A module that needs another module's data declares a port it owns (for
example `trips/application/ports/offer-catalogue.ts`), and the container fills
it from the other module.

## 4. Kemi AI service (`services/kemi`)

Kemi is a separate Express app and deliberately not layered:

```
server.ts → app.ts (Express) → routes/chat.ts (validate, stream)
                                   → agents/kemi.ts (AI SDK agent)
                                       → ai/models.ts (provider registry)
                                       → ai/langfuse.ts (tracing)
```

The browser never calls Kemi directly:

```
browser
  → /api/v1/kemi/[...path]                (src/app/api/v1/kemi)
  → kemi-proxy-controller                 (auth, origin check, flag)
  → FetchKemiGateway                      (KEMI_URL, default :4100)
  → services/kemi POST /v1/chat           (SSE stream piped back unchanged)
```

Set `KEMI_ENABLED=true` to open the proxy. Design records live in
`services/kemi/docs/adr/` and phased specs in `services/kemi/specs/`.

## 5. Other folders

| Folder                | Holds                                                      |
| --------------------- | ---------------------------------------------------------- |
| `scripts/`            | Migrate and seed scripts, `check-*.mjs` integration checks |
| `tests/`              | Vitest unit and component tests                            |
| `docs/`               | Architecture, QA and redesign notes                        |
| `artifacts/`          | QA check outputs and the onboarding framework PDF          |
| `tourism-v1-handoff/` | Original product spec, contracts, demo data and prompts    |
| `skills/`             | Agent skills, such as UI formatting rules                  |
