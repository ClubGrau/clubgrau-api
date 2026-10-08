# Spec: Slice 4 — HTTP + contract (catalog and the four writes)

> Public surface, wiring, and the first living contract.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-commands.md`](./02-commands.md) and [`03-query.md`](./03-query.md).  
> Design §9 / §11 / §12. PRD §3 HTTP and §7.  
> Next: none. The board, customer indication, and rank stay later PRDs.

## Responsibility (this spec only)

Ship the five routes through the new hexagon: request shapes → controllers → routes → `makeIndicationsModule` → `app.ts` → `src/client/indication.http` → `AGENT.md`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md)–[`03`](./03-query.md) | Domain, persistence, commands, and query already shipped |
| **This file** | HTTP gate, error map, composition root, living contract |

Paths below are under `src/modules/indications/` unless noted.

## When to use this spec

Follow the constitution **new module** playbook from the HTTP step onward. Reuse `authTokenMiddleware`, `requireRoles('ADMIN', 'MANAGER')`, and `adaptRoute` on every route. Do not add a domain role policy.

| Artifact | This slice? |
|----------|-------------|
| Five request types + five controllers + controller specs | Yes |
| `infrastructure/inbound/http/indication.routes.ts` | Yes |
| `indications.module.ts` | Yes |
| `app.ts` mounts the router | Yes |
| `src/client/indication.http` | Yes |
| `src/modules/indications/AGENT.md` | Yes — first version, after the routes exist |
| Board, customer fields, day count, seed | **No** |
| Changing employees or customers routes | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of the Indication Catalog following [`docs/specs/indication-catalog/04-http-and-contract.md`](./04-http-and-contract.md).  
> Five routes, each `authTokenMiddleware` + `requireRoles('ADMIN','MANAGER')` + `adaptRoute`. Create is `201`. Correct, end, reopen, and the catalog are `200`. Name taken is `409`. Unknown category, Amigo, bad name, and unknown origin id are `400`.  
> Wire `makeIndicationsModule` in `app.ts`. Add `indication.http` and `AGENT.md`. Do not seed origins. Do not add a field on Customer.

## HTTP surface

All five:

```text
authTokenMiddleware → requireRoles('ADMIN', 'MANAGER') → adaptRoute
```

```http
GET /api/indication-catalog
Authorization: Bearer <token>
```

```http
POST /api/indication-origin
Authorization: Bearer <token>
{ "categoryId": "canal", "name": "Facebook" }
```

`categoryId` `canal` or `campanha` can succeed. `amigo` is `400`.

```http
PATCH /api/indication-origin/:id
Authorization: Bearer <token>
{ "name": "Instagram Ads" }
```

```http
POST /api/indication-origin/:id/end
Authorization: Bearer <token>
```

```http
POST /api/indication-origin/:id/reopen
Authorization: Bearer <token>
```

End and reopen have no body. Ignore a body if one is sent; do not require `name`.

`:id` wins over a body `id`. `adaptRoute` merges body, then params, then stamps `actorId`. Use cases ignore `actorId`. Do not put it on the DTO.

Success body for every write is `{ data: { id } }`. Create uses `created` (`201`). Correct, end, and reopen use `ok` (`200`), including the no-op path.

Catalog success is `ok` (`200`):

```json
{
  "data": {
    "categories": [
      {
        "id": "canal",
        "name": "Canal",
        "holdsOrigins": true,
        "origins": [
          {
            "id": "<24-hex>",
            "categoryId": "canal",
            "name": "Facebook",
            "active": true
          }
        ]
      },
      {
        "id": "campanha",
        "name": "Campanha",
        "holdsOrigins": true,
        "origins": []
      },
      {
        "id": "amigo",
        "name": "Amigo",
        "holdsOrigins": false,
        "origins": []
      }
    ]
  }
}
```

| Situation | HTTP |
|-----------|------|
| Create ok | `201` `{ data: { id } }` |
| Correct / end / reopen ok, including no-op | `200` `{ data: { id } }` |
| Catalog ok | `200` `{ data: { categories } }` |
| Missing `categoryId` or `name` on create; create `name` not a string | `400` |
| Correct body without `name`, or `name` not a string | `400` |
| Blank name, name length, unknown category, Amigo | `400` (VO or domain error from the use case) |
| Unknown origin id on correct, end, reopen | `400` |
| Name reserved in the category | `409` |
| No / invalid session | `401` (existing auth middleware — do not retest it here) |
| `EMPLOYEE` | `403` (`requireRoles` — do not retest it in the controller spec) |
| Unexpected, including 0-document `$set` | `500` |

Unknown keys on create and correct are ignored (`position`, `active`, `intervals`, `foo`).

This API has no `404`. Do not map a miss to `notFound`.

## Request types

Raw HTTP shapes. Do not reuse the application DTO as the unvalidated body.

`presentation/http/create-indication-origin.request.ts`

```ts
export type CreateIndicationOriginRequest = {
  categoryId?: unknown
  name?: unknown
  id?: string
  actorId?: string
}
```

`presentation/http/correct-indication-origin-name.request.ts`

```ts
export type CorrectIndicationOriginNameRequest = {
  id?: string
  name?: unknown
  actorId?: string
}
```

`presentation/http/end-indication-origin.request.ts` and `reopen-indication-origin.request.ts`

```ts
export type EndIndicationOriginRequest = {
  id?: string
  actorId?: string
}
```

`presentation/http/get-indication-catalog.request.ts`

```ts
export type GetIndicationCatalogRequest = {
  actorId?: string
}
```

The catalog controller does not read the request. The type exists so `adaptRoute` has a slot for the stamped actor.

## Controllers (normative)

Express-free. Each controller injects only its inbound port.

### Create — `presentation/controllers/create-indication-origin.controller.ts`

1. `'categoryId' in request` is false, or `'name' in request` is false → `400` `MissingParamError`. Do not call the port.
2. `categoryId` or `name` is not a `string` → `400` `InvalidParamError`. Do not call the port. (`null` is present and not a string.)
3. Forward `{ categoryId, name }` as those strings, including whitespace. `Name.create` inside the use case rejects a blank name. Do not drop unknown keys onto the DTO. Do not forward `actorId` or `id`.
4. Success → `created({ id })`.
5. `catch`:

| Error | Helper |
|-------|--------|
| `IndicationCategoryUnknownError` | `badRequest` (`400`) |
| `IndicationCategoryDoesNotHoldOriginsError` | `badRequest` (`400`) |
| `InvalidNameError` | `badRequest` (`400`) |
| `IndicationOriginNameTakenError` | `conflict` (`409`) |
| anything else | `serverError` (`500`) |

### Correct — `presentation/controllers/correct-indication-origin-name.controller.ts`

1. `'name' in request` is false → `400` `MissingParamError`. Do not call the port.
2. `name` is not a `string` → `400` `InvalidParamError`. Do not call the port.
3. Missing `id` (after params win) → `400` `MissingParamError`.
4. Forward `{ id: String(request.id), name }`. Ignore unknown keys and `actorId`.
5. Success → `ok({ id })`.
6. `catch`: `InvalidNameError` and `IndicationOriginNotFoundError` → `badRequest`. `IndicationOriginNameTakenError` → `conflict`. Else `serverError`.

### End and reopen

1. Missing `id` → `400`. Do not call the port.
2. Forward `{ id: String(request.id) }` only.
3. Success → `ok({ id })`, including when the use case no-op’d.
4. `catch`: `IndicationOriginNotFoundError` → `badRequest`. Else `serverError`. These two do not map `IndicationOriginNameTakenError`; they do not change the name.

### Catalog — `presentation/controllers/get-indication-catalog.controller.ts`

1. Call `execute()` with no args.
2. Success → `ok(result)` so the body is `{ data: { categories } }`.
3. `catch` → `serverError`. This query does not throw the name or not-found errors.

## Routes

File: `infrastructure/inbound/http/indication.routes.ts`.

```ts
export function makeIndicationRoutes(deps: {
  getIndicationCatalogController: GetIndicationCatalogController
  createIndicationOriginController: CreateIndicationOriginController
  correctIndicationOriginNameController: CorrectIndicationOriginNameController
  endIndicationOriginController: EndIndicationOriginController
  reopenIndicationOriginController: ReopenIndicationOriginController
  authTokenMiddleware: RequestHandler
  requireRoles: (...roles: string[]) => RequestHandler
}): Router
```

One `const requiredRole = requireRoles('ADMIN', 'MANAGER')` shared by every route. Same pair as `GET /employees` and `POST /employee`.

| Method | Path |
|--------|------|
| `GET` | `/indication-catalog` |
| `POST` | `/indication-origin` |
| `PATCH` | `/indication-origin/:id` |
| `POST` | `/indication-origin/:id/end` |
| `POST` | `/indication-origin/:id/reopen` |

`app.ts` mounts `app.use('/api', indications.router)`, so the public paths are `/api/...`. Do not prefix `/api` inside the router.

## Module factory

File: `indications.module.ts`.

```ts
makeIndicationsModule({
  connection,
  authTokenMiddleware,
  makeRequireRoles,
}): {
  router
  // controllers and ports, same idea as CustomersModule
}
```

Composition, in order:

1. `connection.model('IndicationOrigin', IndicationOriginSchema)` + `IndicationOriginMongooseRepository`.
2. `new IndicationOriginNamePolicy(repository)`.
3. Create, correct, end, reopen use cases. Create and correct receive the policy and the repository. End and reopen receive the repository. The query receives the repository as `ListIndicationOriginsPort` (the same instance).
4. Five controllers, each with its inbound port.
5. `makeIndicationRoutes` with `authTokenMiddleware` and `makeRequireRoles`.

Do not inject the encrypter, the mailer, or a compare-hash port. Do not call a seed.

## `app.ts`

Next to employees and customers:

```ts
const indications = makeIndicationsModule({
  connection,
  authTokenMiddleware: auth.authTokenMiddleware,
  makeRequireRoles: auth.makeRequireRoles,
})

app.use('/api', indications.router)
```

Do not pass `encrypter` or `mailer`.

## `.http`

File: `src/client/indication.http`. No `actorId` in any body. Comment that the actor is the Bearer token and that `:id` is the path.

Minimum samples:

- `GET /api/indication-catalog`
- `POST /api/indication-origin` `{ "categoryId": "canal", "name": "Facebook" }`
- `POST` `{ "categoryId": "campanha", "name": "Verão" }`
- `PATCH /api/indication-origin/{{originId}}` `{ "name": "Instagram Ads" }`
- `POST .../end` with no body
- `POST .../reopen` with no body
- Comment: `categoryId: "amigo"` → `400`; a second create with the same name in that category, any case → `409`; `EMPLOYEE` → `403`; missing token → `401`

## `AGENT.md`

Create `src/modules/indications/AGENT.md`. It is the living contract, not a copy of the design doc and not a changelog.

Include:

- Delivered table: the five routes
- Directory map of the files these slices added
- Domain: categories, origin behaviour, errors, name policy, availability port
- Application: each command’s port, DTO, and flow; the catalog query and the row it does not return (`position`, intervals, `nameKey`)
- HTTP: the five routes, the error table, the gate `requireRoles('ADMIN', 'MANAGER')`
- Persistence: collection `origins`, unique `(categoryId, nameKey)`, repository methods, no seed
- Wiring: the composition list above
- Open decisions: none of the v1 non-goals are half-implemented. Point the board, customer indication, rank, and friend row at a later PRD. Note that repeated end / reopen / same-name correct are `200`

Do not document a category repository or a startup seed.

## Files

| File | Action |
|------|--------|
| `presentation/http/*.request.ts` (five) | Create |
| `presentation/controllers/*.controller.ts` + `*.spec.ts` (five) | Create |
| `infrastructure/inbound/http/indication.routes.ts` | Create |
| `indications.module.ts` | Create |
| `src/app.ts` | Mount the module |
| `src/client/indication.http` | Create |
| `src/modules/indications/AGENT.md` | Create |
| Domain / use cases / repository behaviour | Do not re-implement |

## Spec expectations

Stub the inbound port. Do not test Express middleware here (`requireRoles` and `adaptRoute` already have their own specs).

### Create controller

| `it(...)` | Assert |
|-----------|--------|
| missing `categoryId` or `name` | `400`; port not called |
| `name: null` / `categoryId: 1` | `400`; port not called |
| `{ categoryId: 'canal', name: 'Facebook', position: 9 }` | port called with `{ categoryId: 'canal', name: 'Facebook' }` only |
| `actorId` on the request | not forwarded |
| `IndicationCategoryUnknownError` / does-not-hold / `InvalidNameError` | `400` |
| `IndicationOriginNameTakenError` | `409` |
| generic throw | `500` |
| success | `201` `{ data: { id } }` |

### Correct controller

| `it(...)` | Assert |
|-----------|--------|
| no `name` | `400`; port not called |
| `name: null` | `400`; port not called |
| `{ name: 'Instagram Ads', id: 'forged' }` | port `id` is the request `id` the controller was given (params already won in `adaptRoute`); `name` forwarded |
| `IndicationOriginNotFoundError` / `InvalidNameError` | `400` |
| `IndicationOriginNameTakenError` | `409` |
| success, including a use case that resolves without the test knowing it was a no-op | `200` `{ data: { id } }` |

### End, reopen

| `it(...)` | Assert |
|-----------|--------|
| missing `id` | `400`; port not called |
| port called | `{ id }` only |
| `IndicationOriginNotFoundError` | `400` |
| generic throw | `500` |
| success | `200` `{ data: { id } }` |

### Catalog controller

| `it(...)` | Assert |
|-----------|--------|
| `execute` called with no args | |
| success | `200`; body `data.categories` is the port result |
| generic throw | `500` |

## Checklist (agent)

- [ ] Every route uses `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`
- [ ] Create is `201`; the other four successes are `200`
- [ ] Name taken → `409` on create and correct only
- [ ] Unknown category, Amigo, bad name, unknown origin id → `400`
- [ ] Controllers are Express-free and do not send `actorId` into the use case
- [ ] `:id` is what correct / end / reopen forward
- [ ] Module builds one repository and shares it across policy, writes, and `list`
- [ ] `app.ts` mounts `/api` and does not inject the encrypter or the mailer
- [ ] No seed on boot
- [ ] `.http` has the samples above and no `actorId`
- [ ] `AGENT.md` lists the five routes, the error map, and the non-goals left for later
- [ ] Controller specs pass

## Out of scope

- The board and a day count on `GET`
- A field on Customer, rank, the friend row
- Category create / rename / delete
- Deleting or moving an origin
- Seeding channels or campaigns
- A domain policy that reloads the actor to repeat `requireRoles`

## Acceptance criteria

- [ ] Fresh process, empty collection: `GET /api/indication-catalog` returns Canal, Campanha, Amigo, in that order, each with `origins: []`. Boot inserted nothing
- [ ] `ADMIN` or `MANAGER` creates a channel and a campaign; each is last in its category; `GET` includes them. The first origin in an empty category has `position` 1 (not returned on `GET`; covered by the create spec)
- [ ] Create `categoryId: "amigo"` → `400`, no write. Unknown `categoryId` → `400`, no write
- [ ] Name that normalizes to fewer than 2 or more than 100 characters → `400`. Name of only spaces → `400`
- [ ] Same `nameKey` in the category, any letter case, holder active or ended → `409`, no write. The same name in the other category → `201`
- [ ] `"Google  Ads"` then `"Google Ads"` in the same category → the second is `409`
- [ ] Correct keeps the id and the category. The previous `nameKey` becomes free. Correct onto another origin’s key in the category → `409`, original name unchanged
- [ ] Correct to the same name, including spacing and case only → `200`, no write
- [ ] End keeps the origin on `GET`, `active: false`, same name. A second end → `200`, intervals unchanged. Reopen → `active: true`. A second reopen → `200`, no new interval
- [ ] End, reopen, and correct of an unknown id → `400`
- [ ] `EMPLOYEE` on `GET` and on every write → `403`. No session → `401`
- [ ] `GET` origin objects are `id`, `categoryId`, `name`, `active` only
- [ ] `AGENT.md` and `indication.http` exist

## Reference map

| Concern | Look at |
|---------|---------|
| Role gate + `adaptRoute` | `employees/infrastructure/inbound/http/employee.routes.ts` |
| Module factory | `customers/customers.module.ts` (this module also takes `makeRequireRoles`, like employees) |
| Composition root | `src/app.ts` |
| `created` / `ok` / `badRequest` / `conflict` | `@shared/presentation` http helpers |
| Living-contract shape | `employees/AGENT.md` (sections, not its content) |
| Design | [`docs/design-docs/indication-catalog-v1.md`](../../design-docs/indication-catalog-v1.md) §9–§13 |
