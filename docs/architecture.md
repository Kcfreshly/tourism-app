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
