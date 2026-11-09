# Module boundaries

The backend is organised by business area, following the same layering as the
SME Operations Platform API. It runs inside the Next.js app today; the domain
and application layers import nothing from Next.js, so the modules can move to
a separate API later without rewriting business logic.

## Dependency direction

Within a module:

```
presentation -> application -> domain
infrastructure -> application/domain
```

- **domain**: business rules and types. Shared with the browser for instant
  feedback, so it imports no Next.js, Drizzle or auth code. Plain libraries
  (Zod, AJV) are allowed.
- **application**: use cases (`use-cases/`), the ports they need
  (`ports/`), and helpers used by several use cases (`services/`). Use cases
  throw `AppError` with a kind (`INVALID`, `NOT_FOUND`, `CONFLICT`, ...), never
  an HTTP status.
- **infrastructure**: Drizzle repositories and table schemas, Better Auth.
  Implements the ports. A repository may read another module's table schema
  inside one transaction (for example, writing an audit event), but never
  another module's repository.
- **presentation**: controllers, request schemas, request guards and page
  guards. Controllers check the origin, identify the caller, throttle, parse
  the request, call one use case and map the result to the response envelope.

Outside the modules:

- `src/bootstrap/container.ts` is the composition root. It creates
  repositories, use cases and controllers, and is the only file that knows the
  concrete classes.
- `src/app/api/**/route.ts` files only map HTTP methods to controllers from
  the container.
- `src/database` holds the lazy Drizzle client, the combined schema and the
  SQL row helper. `src/config` holds environment checks.
- `src/shared` holds `AppError` and the HTTP response envelope.

`npm run lint` enforces these rules: domain and application code cannot import
Next.js, Drizzle, Better Auth, infrastructure, presentation or the container;
browser components and hooks can import module domain code only.

## Ownership

| Module    | Owns                                                                      |
| --------- | ------------------------------------------------------------------------- |
| identity  | Accounts, sessions, roles, legacy guest drafts, origin checks, throttling |
| catalogue | Listings, review and publishing workflow, events, photos                  |
| trips     | Trip profile, itinerary, services, pricing, intake, proposals             |
| bucket    | Saved activities per account                                              |
| audit     | Audit event table, written by other modules inside their transactions     |

Cross-module needs go through a port owned by the consuming module (for
example `trips/application/ports/offer-catalogue.ts`), wired up in the
container.

Bookings and payments will be added as new modules in this structure.
