# Indications Module — Agent Guide

> Living **contract** of the indications hexagon (catalog query + create, correct, end, and reopen an origin).
>
> Global rules (architecture, naming, testing, playbooks): [`AGENTS.md`](../../../AGENTS.md).
> Structure diagrams / folder tree: [`docs/project-structure.md`](../../../docs/project-structure.md).
> Ubiquitous language: [`CONTEXT.md`](./CONTEXT.md).

## Purpose of this document

Use this file to extend **this** module without breaking its current contracts:

- Public HTTP surface, ports, DTOs, domain invariants
- Persistence mapping and wiring specific to indications

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** when any of the following change for indications:

| Change type         | Examples                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| Public HTTP surface | New route, method, path, or response shape                                |
| Domain invariants   | Category rules, name reservation, end/reopen behaviour                    |
| Ports / DTOs        | New inbound/outbound port, DTO fields, return contracts                   |
| Persistence mapping | Schema fields, mapper rules, repository responsibilities                  |
| Open decisions      | Resolved TODOs, new known limitations                                     |
| Module layout       | New folder under this hexagon, wiring pattern change local to indications |

Global convention changes belong in [`AGENTS.md`](../../../AGENTS.md), not here.

After a meaningful change, update the relevant section(s) in place.

---

## Module status

### Delivered

| Capability                               | Status | Entry point                                                |
| ---------------------------------------- | ------ | ---------------------------------------------------------- |
| Get indication catalog (query)           | Done   | `GET /api/indication-catalog`                              |
| Create indication origin (command)       | Done   | `POST /api/indication-origin`                              |
| Correct indication origin name (command) | Done   | `PATCH /api/indication-origin/:id`                         |
| End indication origin (command)          | Done   | `POST /api/indication-origin/:id/end`                      |
| Reopen indication origin (command)       | Done   | `POST /api/indication-origin/:id/reopen`                   |
| Name reservation policy                  | Done   | `IndicationOriginNamePolicy.ensureAvailable`               |
| Mongo persistence                        | Done   | `IndicationOriginMongooseRepository`                       |
| Auth + role gate on every route          | Done   | `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` |
| Module HTTP ownership                    | Done   | `infrastructure/inbound/http/indication.routes.ts`         |
| Composition root wiring                  | Done   | `indications.module.ts` + `app.ts`                         |

Categories are fixed in code (`IndicationCategories`). There is no category collection and no startup seed of channels or campaigns.

### CQRS in this module

| Side            | Location                | Example                                                                                                                              |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Command (write) | `application/usecases/` | `CreateIndicationOriginUsecase`, `CorrectIndicationOriginNameUsecase`, `EndIndicationOriginUsecase`, `ReopenIndicationOriginUsecase` |
| Query (read)    | `application/queries/`  | `GetIndicationCatalogQuery`                                                                                                          |

The catalog query does **not** call `IndicationOrigin.create`, the name policy, or any write port. It returns a read model. Origin objects on that model are `id`, `categoryId`, `name`, `active` only.

### Future work

Left for a later PRD. None of these are half-implemented here:

- Board and a day count on `GET`
- A field on Customer, rank, and the friend row
- Category create / rename / delete
- Deleting or moving an origin
- Seeding channels or campaigns
- A domain policy that reloads the actor to repeat `requireRoles`

---

## Directory map

```text
src/modules/indications/
├── AGENT.md
├── CONTEXT.md
├── indications.module.ts
│
├── domain/
│   ├── entities/
│   │   ├── IndicationOrigin.ts
│   │   └── indication-origin.spec.ts
│   ├── models/
│   │   └── indication-origin.model.ts
│   ├── ports/
│   │   └── indication-origin-name-availability.port.ts
│   ├── errors/
│   │   └── indication.errors.ts
│   ├── services/
│   │   ├── indication-origin-name.policy.ts
│   │   └── indication-origin-name.policy.spec.ts
│   ├── indication-categories.ts
│   └── indication-categories.spec.ts
│
├── application/
│   ├── dtos/
│   │   ├── create-indication-origin.dto.ts
│   │   ├── correct-indication-origin-name.dto.ts
│   │   ├── end-indication-origin.dto.ts
│   │   ├── reopen-indication-origin.dto.ts
│   │   └── get-indication-catalog.dto.ts
│   ├── mappers/
│   │   └── indication-origin-snapshot.mapper.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   ├── create-indication-origin.port.ts
│   │   │   ├── correct-indication-origin-name.port.ts
│   │   │   ├── end-indication-origin.port.ts
│   │   │   ├── reopen-indication-origin.port.ts
│   │   │   └── get-indication-catalog.port.ts
│   │   └── outbound/
│   │       ├── insert-indication-origin-repository.port.ts
│   │       ├── update-indication-origin-name-repository.port.ts
│   │       ├── update-indication-origin-intervals-repository.port.ts
│   │       ├── next-indication-origin-position.port.ts
│   │       ├── find-indication-origin-by-id.port.ts
│   │       └── list-indication-origins.port.ts
│   ├── usecases/
│   │   ├── create-indication-origin.usecase.ts
│   │   ├── create-indication-origin.usecase.spec.ts
│   │   ├── correct-indication-origin-name.usecase.ts
│   │   ├── correct-indication-origin-name.usecase.spec.ts
│   │   ├── end-indication-origin.usecase.ts
│   │   ├── end-indication-origin.usecase.spec.ts
│   │   ├── reopen-indication-origin.usecase.ts
│   │   └── reopen-indication-origin.usecase.spec.ts
│   └── queries/
│       ├── get-indication-catalog.query.ts
│       └── get-indication-catalog.query.spec.ts
│
├── presentation/
│   ├── http/
│   │   ├── create-indication-origin.request.ts
│   │   ├── correct-indication-origin-name.request.ts
│   │   ├── end-indication-origin.request.ts
│   │   ├── reopen-indication-origin.request.ts
│   │   └── get-indication-catalog.request.ts
│   └── controllers/
│       ├── create-indication-origin.controller.ts
│       ├── create-indication-origin.controller.spec.ts
│       ├── correct-indication-origin-name.controller.ts
│       ├── correct-indication-origin-name.controller.spec.ts
│       ├── end-indication-origin.controller.ts
│       ├── end-indication-origin.controller.spec.ts
│       ├── reopen-indication-origin.controller.ts
│       ├── reopen-indication-origin.controller.spec.ts
│       ├── get-indication-catalog.controller.ts
│       └── get-indication-catalog.controller.spec.ts
│
└── infrastructure/
    ├── inbound/http/
    │   └── indication.routes.ts
    └── outbound/persistence/
        ├── indication-origin.schema.ts
        ├── indication-origin.mapper.ts
        ├── indication-origin-mongoose.repository.ts
        └── indication-origin-mongoose.repository.spec.ts
```

---

## Domain model

### Categories

`IndicationCategories` is a fixed list, in this order:

| id         | name     | holdsOrigins |
| ---------- | -------- | ------------ |
| `canal`    | Canal    | true         |
| `campanha` | Campanha | true         |
| `amigo`    | Amigo    | false        |

`requireHoldingOrigins` throws `IndicationCategoryUnknownError` for an unknown id and `IndicationCategoryDoesNotHoldOriginsError` for Amigo. An operator does not create, rename, or delete a category.

### Origin

An origin lives in Canal or Campanha. It keeps one name, a `nameKey`, a `position`, and a list of intervals. `active` is true when the last interval is still open (`to === null`).

- **Create** opens one interval and takes the next `position` in that category (the first origin in an empty category is `1`).
- **Correct the name** keeps the id and the category. The previous `nameKey` becomes free. The same key, including spacing and case only, is a no-op (`correctName` returns `false`).
- **End** closes the open interval. Ending an origin that is already ended changes nothing.
- **Reopen** appends a new open interval. Reopening an origin that is already active changes nothing.

The record is never deleted and never moves to the other category. `nameKey` is the normalized name (`Name.create`, then lower case).

### Errors

| Error                                       | When                                                             |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `IndicationCategoryUnknownError`            | `categoryId` is not Canal, Campanha, or Amigo                    |
| `IndicationCategoryDoesNotHoldOriginsError` | category is Amigo                                                |
| `IndicationOriginNotFoundError`             | correct / end / reopen id misses                                 |
| `IndicationOriginNameTakenError`            | `nameKey` is already reserved in that category (active or ended) |
| `InvalidNameError`                          | shared `Name` VO: blank, or normalized length outside 2–100      |

### Name policy

`IndicationOriginNamePolicy.ensureAvailable` asks `IndicationOriginNameAvailabilityPort.existsByNameKey`. Create omits `exceptOriginId`. Correct passes the origin id so the holder does not collide with itself. A taken key throws `IndicationOriginNameTakenError`.

---

## Application: Create Indication Origin (command)

Port: `CreateIndicationOriginPort`. DTO: `{ categoryId, name }` → `{ id }`.

1. `IndicationCategories.requireHoldingOrigins(categoryId)`
2. `IndicationOrigin.nameKeyFrom(name)` (rejects a bad name)
3. `namePolicy.ensureAvailable({ categoryId, nameKey })`
4. `nextPosition(category.id)` then `IndicationOrigin.create` and `insert`
5. Return `{ id }`

The same display name in the other category is allowed. `"Google  Ads"` and `"Google Ads"` share one `nameKey`.

## Application: Correct Indication Origin Name (command)

Port: `CorrectIndicationOriginNamePort`. DTO: `{ id, name }` → `{ id }`.

1. `findById`; miss → `IndicationOriginNotFoundError`
2. `correctName(name)`; `false` → return `{ id }` with no write
3. `ensureAvailable` with `exceptOriginId`
4. `updateName` then return `{ id }`

A collision leaves the stored name unchanged.

## Application: End Indication Origin (command)

Port: `EndIndicationOriginPort`. DTO: `{ id }` → `{ id }`.

1. `findById`; miss → `IndicationOriginNotFoundError`
2. `end()`; `false` → return `{ id }` with no write
3. `updateIntervals` then return `{ id }`

Does not change the name and does not throw `IndicationOriginNameTakenError`.

## Application: Reopen Indication Origin (command)

Port: `ReopenIndicationOriginPort`. DTO: `{ id }` → `{ id }`.

Same shape as end, calling `reopen()` instead of `end()`.

## Application: Get Indication Catalog (query)

Port: `GetIndicationCatalogPort`. `execute()` takes no arguments. Result: `{ categories }`.

Each category from `IndicationCategories.list()` is returned in order. A category that does not hold origins always has `origins: []`. Holding categories list rows for that `categoryId`, sorted by `position` then `id`.

The HTTP origin object drops `position`, intervals, and `nameKey`. The list port row still carries `position` so the query can sort.

---

## Presentation & HTTP

Every route:

```text
authTokenMiddleware → requireRoles('ADMIN', 'MANAGER') → adaptRoute
```

`app.ts` mounts the router at `/api`. Paths inside the router have no `/api` prefix.

| Method  | Path                                | Success                          |
| ------- | ----------------------------------- | -------------------------------- |
| `GET`   | `/api/indication-catalog`           | `200` `{ data: { categories } }` |
| `POST`  | `/api/indication-origin`            | `201` `{ data: { id } }`         |
| `PATCH` | `/api/indication-origin/:id`        | `200` `{ data: { id } }`         |
| `POST`  | `/api/indication-origin/:id/end`    | `200` `{ data: { id } }`         |
| `POST`  | `/api/indication-origin/:id/reopen` | `200` `{ data: { id } }`         |

Repeated end, repeated reopen, and a correct that only changes spacing or case are `200`. This API has no `404`.

The actor is the Bearer token (`adaptRoute` stamps `actorId`). Controllers do not forward `actorId`. `:id` wins over a body `id`. End and reopen ignore a body. Unknown keys (`position`, `active`, `intervals`, `foo`) are ignored.

Create checks required `categoryId` and `name` with `validationRequiredFields`. A falsy value is `MissingParamError`. The use case receives `{ categoryId, name }` only, whitespace included.

Correct checks required `id` and `name` with `validationRequiredFields`. A falsy value is `MissingParamError`. The use case receives `{ id, name }` only. `actorId` is not forwarded.

End checks required `id` with `validationRequiredFields`. A falsy value is `MissingParamError`. The use case receives `{ id }` only. `actorId` is not forwarded.

Reopen checks required `id` with `validationRequiredFields`. A falsy value is `MissingParamError`. The use case receives `{ id }` only. `actorId` is not forwarded.

| Situation                                                                     | HTTP  |
| ----------------------------------------------------------------------------- | ----- |
| Missing `categoryId` or `name` on create                                       | `400` |
| Missing `id` or `name` on correct                                             | `400` |
| Missing `id` on end or reopen                                                 | `400` |
| Blank name, name length, unknown category, Amigo                              | `400` |
| Unknown origin id on correct, end, reopen                                     | `400` |
| Name reserved in the category (create and correct only)                       | `409` |
| No / invalid session                                                          | `401` |
| `EMPLOYEE`                                                                    | `403` |
| Unexpected, including a 0-document `$set`                                     | `500` |

| Error                                       | Create | Correct | End / reopen       | Catalog |
| ------------------------------------------- | ------ | ------- | ------------------ | ------- |
| `IndicationCategoryUnknownError`            | `400`  | —       | —                  | —       |
| `IndicationCategoryDoesNotHoldOriginsError` | `400`  | —       | —                  | —       |
| `InvalidNameError`                          | `400`  | `400`   | —                  | —       |
| `IndicationOriginNotFoundError`             | —      | `400`   | `400`              | —       |
| `IndicationOriginNameTakenError`            | `409`  | `409`   | `500` (not mapped) | —       |
| anything else                               | `500`  | `500`   | `500`              | `500`   |

Samples: `src/client/indication.http`. No sample body sends `actorId`.

---

## Persistence

### Schema

- Model name: `IndicationOrigin`
- Collection: `origins`
- Unique index: `(categoryId, nameKey)`
- Fields: `categoryId` (`canal` \| `campanha`), `name`, `nameKey`, `position`, `createdAt`, `intervals[]` (`from`, `to`)
- Boot does not insert channels or campaigns

### Repository

`IndicationOriginMongooseRepository` is one instance shared by the policy, the four writes, and `list`. It implements:

- `InsertIndicationOriginRepositoryPort` → `insert` (duplicate key `11000` → `IndicationOriginNameTakenError`)
- `UpdateIndicationOriginNameRepositoryPort` → `updateName` (`$set` of `name` and `nameKey`; 0 matches → `Error`; duplicate key → `IndicationOriginNameTakenError`)
- `UpdateIndicationOriginIntervalsRepositoryPort` → `updateIntervals` (`$set` of `intervals`; 0 matches → `Error`)
- `IndicationOriginNameAvailabilityPort` → `existsByNameKey`
- `NextIndicationOriginPositionPort` → `nextPosition`
- `FindIndicationOriginByIdPort` → `findById` (miss or invalid id → `null`)
- `ListIndicationOriginsPort` → `list`

There is no category repository.

---

## Wiring (`indications.module.ts`)

Factory: `makeIndicationsModule({ connection, authTokenMiddleware, makeRequireRoles })`.

`app.ts` passes `auth.authTokenMiddleware` and `auth.makeRequireRoles`. It does not pass the encrypter, the mailer, or a compare-hash port.

Composition order:

1. `connection.model('IndicationOrigin', IndicationOriginSchema)`
2. `IndicationOriginMongooseRepository` — one instance
3. `IndicationOriginNamePolicy(repository)`
4. `CreateIndicationOriginUsecase(policy, repository, repository)` — next position and insert
5. `CorrectIndicationOriginNameUsecase(policy, repository, repository)` — find by id and update name
6. `EndIndicationOriginUsecase(repository, repository)` — find by id and update intervals
7. `ReopenIndicationOriginUsecase(repository, repository)`
8. `GetIndicationCatalogQuery(repository)` — `ListIndicationOriginsPort`
9. Five controllers, each with its inbound port
10. `makeIndicationRoutes({ ..., authTokenMiddleware, requireRoles: makeRequireRoles })`

Returns the five controllers, the five inbound ports, and `router`. No seed.

**Rule:** when adding a use case or query, wire it in this file; do not construct the repository inside a controller or a use case.

---

## Open decisions / known limitations

1. **Board, customer indication, rank, friend row** — not this hexagon. A later PRD owns them. Amigo stays a category with `origins: []`.
2. **Category CRUD, delete, move** — an origin is corrected, ended, or reopened. It is not removed and it does not change category.
3. **Seed** — a fresh process with an empty `origins` collection returns Canal, Campanha, and Amigo, each with `origins: []`. Boot inserts nothing.
4. **Repeated end / reopen / same-name correct** — `200` and no write. Intervals stay as they were on a second end; a second reopen does not append another interval.
5. **Authorization** — `requireRoles('ADMIN', 'MANAGER')` on every route. There is no domain policy that reloads the actor. `EMPLOYEE` → `403`. No session → `401`.
6. **Misses** — unknown origin id is `400` `IndicationOriginNotFoundError`. This API does not map a miss to `404`.
7. **Name taken** — `409` on create and correct only. End and reopen do not map `IndicationOriginNameTakenError`.
