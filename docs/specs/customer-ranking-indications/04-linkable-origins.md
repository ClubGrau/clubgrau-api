# Spec: Slice 4 — Linkable origins and the origin lookup

> The picker read, and the adapter that answers `customers`.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md) for `FindIndicationOriginPort` only. It does not depend on the customer domain, persistence, or HTTP slices. `ListIndicationOriginsPort` and `FindIndicationOriginByIdPort` already exist.  
> Design §9 and §10.2 / [ADR 0001](../../adr/customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md).  
> Next: [`05-wiring-and-contract.md`](./05-wiring-and-contract.md).

## Responsibility (this spec only)

Let any authenticated employee read the origins that can be linked now, and let `indications` answer “what is this origin?” with facts. Do not change the catalog read or the catalog commands.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-application.md) | Declares `FindIndicationOriginPort` |
| **This file** | Query, inbound port, controller, route signature, adapter, `indication.http` |
| [`05`](./05-wiring-and-contract.md) | `makeIndicationsModule` constructs these and returns `findIndicationOrigin` |

Paths below are under `src/modules/indications/` unless noted.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| Result DTO, inbound port, `GetLinkableIndicationOriginsQuery` + spec | Yes |
| Controller + request type + spec | Yes |
| `indication.routes.ts` gains `GET /indication-linkable-origins` | Yes |
| `IndicationOriginLookupAdapter` + spec | Yes |
| `src/client/indication.http` | Yes |
| A new repository method or a new list port | **No** |
| `indications.module.ts`, `app.ts`, `AGENT.md` | **No** |
| `requireRoles` on this route, or any change to the five catalog routes | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/04-linkable-origins.md`](./04-linkable-origins.md).  
> `GetLinkableIndicationOriginsQuery` filters `ListIndicationOriginsPort` to active rows, Canal then Campanha, `compareByPositionThenId` inside a category, and returns `id`, `categoryId`, `name`.  
> `GET /indication-linkable-origins` is `authTokenMiddleware` only. `IndicationOriginLookupAdapter` implements `FindIndicationOriginPort` via `FindIndicationOriginByIdPort` and `IndicationOriginSnapshotMapper.toEntity`.  
> Do not edit `indications.module.ts` or the catalog routes.

`makeIndicationRoutes` gains a required controller argument. `indications.module.ts` will not type-check until slice 5 passes it. Do not construct the controller inside the route file to hide that.

## Query

### Result — `application/dtos/get-linkable-indication-origins.dto.ts`

```ts
export type LinkableIndicationOriginDto = {
  id: string
  categoryId: 'canal' | 'campanha'
  name: string
}

export interface GetLinkableIndicationOriginsResultDto {
  origins: LinkableIndicationOriginDto[]
}
```

No `active`, `position`, `nameKey`, or `intervals`. No categories. Amigo is not an item.

### Inbound — `application/ports/inbound/get-linkable-indication-origins.port.ts`

```ts
export interface GetLinkableIndicationOriginsPort {
  execute(): Promise<GetLinkableIndicationOriginsResultDto>
}
```

No input. The actor is not loaded.

### `GetLinkableIndicationOriginsQuery`

File: `application/queries/get-linkable-indication-origins.query.ts` + co-located spec.

Constructor takes `ListIndicationOriginsPort` only. Reuse `list()`. Do not add a repository method.

1. `const rows = await this.origins.list()`.
2. Keep rows with `active === true`.
3. Order `'canal'` first, then `'campanha'`. Inside a category, sort with `compareByPositionThenId` from `@shared/application/helpers/compare-by-position-then-id`. `position` is the creation order the catalog already stores. Do not sort by `createdAt` (the row has none).
4. Map each kept row to `{ id, categoryId, name }`.
5. No active row → `origins: []`.

Do not call `IndicationCategories.list` or read `holdsOrigins`. Only `canal` and `campanha` rows exist. Do not reconstitute an origin. Do not call the name policy.

## HTTP

### Request — `presentation/http/get-linkable-indication-origins.request.ts`

```ts
export type GetLinkableIndicationOriginsRequest = {
  actorId?: string
}
```

Same shape as `GetIndicationCatalogRequest`. The controller ignores it.

### Controller

`GetLinkableIndicationOriginsController` follows `GetIndicationCatalogController`: call `execute()`, return `ok(result)`, and `serverError` on throw. No required fields. No role check in the controller.

Success body:

```json
{ "data": { "origins": [ { "id": "...", "categoryId": "canal", "name": "Instagram" } ] } }
```

| Situation | HTTP |
|-----------|------|
| Ok, including an empty list | `200` |
| No / invalid session | `401` (middleware, not this controller) |
| Unexpected | `500` |

### Route

In `makeIndicationRoutes`, add the controller to `IndicationRoutesDependencies` and register:

```ts
router.get(
  '/indication-linkable-origins',
  authTokenMiddleware,
  adaptRoute(getLinkableIndicationOriginsController),
)
```

No `requireRoles`. The five existing routes stay `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`.

`EMPLOYEE`, `MANAGER`, and `ADMIN` all pass this route because the only gate is the session. That is not tested inside the controller. It is the absence of `requireRoles` on this one registration.

## Adapter

File: `infrastructure/outbound/indication-origin-lookup.adapter.ts` + co-located spec.

Implements `FindIndicationOriginPort` from `@modules/customers/application/ports/outbound/find-indication-origin.port`. That import is allowed. Do not import `@modules/customers/domain`.

```ts
constructor(private readonly origins: FindIndicationOriginByIdPort)

findOrigin(id: string) // signature comes from implements FindIndicationOriginPort
```

Do not annotate the return as `IndicationOriginFacts`. That type lives in `customers` domain, and this file must not import it. Structural typing on the port is enough.

1. `const snapshot = await this.origins.findById(id)`.
2. `snapshot === null` → `null`. `findById` already returns `null` for a miss and for a malformed id. Do not catch that again and do not reimplement the hex check.
3. Otherwise `IndicationOriginSnapshotMapper.toEntity(snapshot)`, then return `{ id: entity.id, categoryId: entity.categoryId, active: entity.active }`.

`active` comes from the entity. Do not read `intervals` in the adapter. Do not duplicate the “last interval is open” rule.

The return value matches `IndicationOriginFacts` (`id`, `categoryId`, `active`) by structure. The adapter does not need its own facts type.

## `indication.http`

Add one sample at the end of `src/client/indication.http`:

```http
### Linkable origins
# Qualquer colaborador autenticado, inclusive EMPLOYEE. Sem requireRoles.
# Só origens ativas de Canal e Campanha, Canal primeiro. Sem ativos → origins: [].
# Não devolve categorias, ended, active, nem position.
GET http://localhost:3003/api/indication-linkable-origins
Authorization: Bearer {{token}}
```

Do not change the catalog samples’ role comments.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/indications/application/dtos/get-linkable-indication-origins.dto.ts` |
| Create | `src/modules/indications/application/ports/inbound/get-linkable-indication-origins.port.ts` |
| Create | `src/modules/indications/application/queries/get-linkable-indication-origins.query.ts` |
| Create | `src/modules/indications/application/queries/get-linkable-indication-origins.query.spec.ts` |
| Create | `src/modules/indications/presentation/http/get-linkable-indication-origins.request.ts` |
| Create | `src/modules/indications/presentation/controllers/get-linkable-indication-origins.controller.ts` |
| Create | `src/modules/indications/presentation/controllers/get-linkable-indication-origins.controller.spec.ts` |
| Create | `src/modules/indications/infrastructure/outbound/indication-origin-lookup.adapter.ts` |
| Create | `src/modules/indications/infrastructure/outbound/indication-origin-lookup.adapter.spec.ts` |
| Edit | `src/modules/indications/infrastructure/inbound/http/indication.routes.ts` |
| Edit | `src/client/indication.http` |

## Spec expectations

Query, with a `list` stub:

- Active canal and campanha rows return `{ id, categoryId, name }` only. The objects have no `active` and no `position`.
- An `active: false` row is dropped.
- A campanha row with a smaller `position` than a canal row still comes after every canal row.
- Two canal rows sort by `position`, then by `id`, via `compareByPositionThenId`.
- `list` resolving `[]`, or only inactive rows, returns `{ origins: [] }`.
- `IndicationCategories` is not used (do not import it in the query).

Controller:

- `execute` result is `200` `{ data: result }`, including `{ origins: [] }`.
- `execute` throwing `Error` is `500`.
- The request argument is ignored.

Adapter, with a `findById` stub:

- `null` → `null`, and `toEntity` is not required to run.
- A snapshot whose last interval is open → `{ id, categoryId, active: true }`. Build the snapshot and go through `IndicationOriginSnapshotMapper.toEntity` (or a real `findById` result passed to the real mapper). Assert `active` from the entity, not from a hard-coded `true` in the adapter.
- A snapshot whose last interval has a `to` date → `active: false`.
- The adapter file does not import `@modules/customers/domain`.

## Acceptance criteria

- [ ] The linkable read returns only active Canal and Campanha origins, as `id`, `categoryId`, and `name`.
- [ ] Canal comes first. Inside a category the order is `position`, then `id`.
- [ ] No active origin returns `origins: []`.
- [ ] The route has `authTokenMiddleware` and no `requireRoles`.
- [ ] The catalog routes are unchanged.
- [ ] The adapter returns facts from the entity’s `active`, or `null` when `findById` returns `null`.

## Out of scope

- `makeIndicationsModule`, `makeCustomersModule`, and `app.ts`.
- A new list query on the repository.
- Ending an origin updating any customer. `EndIndicationOriginUsecase` and `ReopenIndicationOriginUsecase` stay as they are.

## Checklist

- [ ] The query reuses `ListIndicationOriginsPort` and `compareByPositionThenId`.
- [ ] The result type has no `active` and no `position`.
- [ ] The route is registered without `requireRoles`.
- [ ] The five catalog routes still use `requireRoles('ADMIN', 'MANAGER')`.
- [ ] The adapter implements `FindIndicationOriginPort` and does not import the customers domain.
- [ ] `indication.http` documents the linkable read.
- [ ] `indications.module.ts` is not edited in this slice.
