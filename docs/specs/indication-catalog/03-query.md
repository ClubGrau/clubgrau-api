# Spec: Slice 3 — `GetIndicationCatalogQuery`

> Application query: three categories, origins nested, no intervals.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md) (`IndicationCategories`), [`01-persistence.md`](./01-persistence.md) (`ListIndicationOriginsPort`). Does **not** depend on [`02-commands.md`](./02-commands.md).  
> Design §8.4.  
> Next: [`04-http-and-contract.md`](./04-http-and-contract.md).

## Responsibility (this spec only)

Return the catalog the screen paints: Canal, Campanha, Amigo, each with its origins. The query does not reconstitute an origin, does not call the name policy, and does not see intervals.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | `IndicationCategories.list` |
| [`01`](./01-persistence.md) | `list()` rows `{ id, categoryId, name, position, active }` |
| **This file** | Inbound port, result DTO, query + spec |
| [`02`](./02-commands.md) | Writes — not used here |
| [`04`](./04-http-and-contract.md) | `GET /api/indication-catalog` |

Paths below are under `src/modules/indications/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `GetIndicationCatalogPort` | Yes |
| Result DTO | Yes |
| `GetIndicationCatalogQuery` + spec | Yes |
| A second `list` method or a row type that includes intervals | **No** |
| Controller / route / module | **No** |
| `IndicationOrigin.create` / `reconstitute` / name policy | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of the Indication Catalog following [`docs/specs/indication-catalog/03-query.md`](./03-query.md).  
> `GetIndicationCatalogQuery` lists the category constant and attaches `list()` rows. Empty categories stay, with `origins: []`.  
> Do not return `position`, intervals, `nameKey`, or a day count. Do not add the controller.

## Application contracts

### Result — `application/dtos/get-indication-catalog.dto.ts`

```ts
interface IndicationCatalogOriginDto {
  id: string
  categoryId: 'canal' | 'campanha'
  name: string
  active: boolean
}

interface IndicationCatalogCategoryDto {
  id: 'canal' | 'campanha' | 'amigo'
  name: 'Canal' | 'Campanha' | 'Amigo'
  holdsOrigins: boolean
  origins: IndicationCatalogOriginDto[]
}

interface GetIndicationCatalogResultDto {
  categories: IndicationCatalogCategoryDto[]
}
```

No `order` field on the category (order is the array). No `position` on the origin. No `intervals`, `nameKey`, `createdAt`, or day count.

There is no input DTO and no pagination.

### Inbound — `application/ports/inbound/get-indication-catalog.port.ts`

```ts
interface GetIndicationCatalogPort {
  execute(): Promise<GetIndicationCatalogResultDto>
}
```

No `actorId`. The route gate is slice 4.

### Query — `application/queries/get-indication-catalog.query.ts`

```ts
constructor(origins: ListIndicationOriginsPort)
```

```text
execute()
  1. rows = origins.list()          // once
  2. categories = IndicationCategories.list()
  3. for each category, origins = rows with that categoryId
       sorted by position ascending, then id ascending
       mapped to { id, categoryId, name, active }
  4. return { categories }
```

A category with no rows is still present, with `origins: []`. Amigo is that case whenever the collection is honest: `holdsOrigins: false`, `origins: []`.

A row whose `categoryId` is not on the constant is omitted. It does not create a fourth category. Do not attach a `canal` row to Campanha.

Do not call `findById`, `IndicationOrigin.reconstitute`, `IndicationOrigin.create`, or `IndicationOriginNamePolicy`.

Do not filter out `active: false`.

Sort is this query’s job. Slice 1 does not promise order. Tie on `position`: smaller `id` string first (`'a' < 'b'`).

## Files

| File | Action |
|------|--------|
| `application/dtos/get-indication-catalog.dto.ts` | Create |
| `application/ports/inbound/get-indication-catalog.port.ts` | Create |
| `application/queries/get-indication-catalog.query.ts` + `*.spec.ts` | Create |
| `ListIndicationOriginsPort` | Already created in slice 1 — do not duplicate |
| Controllers / routes / module / `AGENT.md` / use cases | Do not change |

## Spec expectations (`get-indication-catalog.query.spec.ts`)

`makeStubs` / `makeSut`. Stub `ListIndicationOriginsPort`. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP. No real repository.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `GetIndicationCatalogQuery` |
| `list` returns `[]` | three categories, ids `canal`, `campanha`, `amigo`, names `Canal`, `Campanha`, `Amigo`, `holdsOrigins` true / true / false, each `origins: []` |
| `list` called once | not once per category |
| rows hang on their category | a canal row is not under campanha; campanha stays `[]` when only canal has rows |
| origin shape | exactly `id`, `categoryId`, `name`, `active`. `'position' in origin` is false. `'intervals' in origin` is false. `'nameKey' in origin` is false |
| category shape | exactly `id`, `name`, `holdsOrigins`, `origins`. `'order' in category` is false |
| sort | positions `2`, `1`, `1` with ids `'bbb…'`, `'ccc…'`, `'aaa…'` → position 1 id `aaa` first, then position 1 id `ccc`, then position 2 |
| ended row | `active: false` is included |
| amigo row if the stub returns one | not added as an origin and not a fourth category; Amigo stays `origins: []` |
| constructor | `ListIndicationOriginsPort` only |

Build 24-hex ids in the stub so the sort case is realistic. The query must not require them to be `UniqueEntityId` instances.

## Checklist (agent)

- [ ] Empty `list` still returns three categories in Canal, Campanha, Amigo order
- [ ] Origins nest under `categoryId`
- [ ] Sort is `position`, then `id`
- [ ] Ended origins stay, with `active: false`
- [ ] Result omits `position`, `intervals`, `nameKey`, `order`, and any day count
- [ ] `list` is called once
- [ ] No reconstitute, no name policy, no write port
- [ ] Co-located spec covers the table
- [ ] No controller / route / `AGENT.md`

## Out of scope

- `GET` route and controller (slice 4)
- Day count, board, search, attention order
- Seeding rows so the empty catalog is non-empty
- Customer fields

## Acceptance criteria

- [ ] No rows → Canal, Campanha, Amigo, in that order, each with `origins: []` and the `holdsOrigins` flags
- [ ] A channel and a campaign come back under their own category
- [ ] Inside a category, lower `position` comes first; equal `position` breaks by `id`
- [ ] An ended origin is in the list with `active: false`
- [ ] Origin objects are `id`, `categoryId`, `name`, `active` only
- [ ] Query spec passes
- [ ] Query does not import the use cases

## Reference map

| Concern | Look at |
|---------|---------|
| Query + stubbed read port | `employees/application/queries/get-own-employee.query.ts` |
| Categories | `domain/indication-categories.ts` |
| Read port | `application/ports/outbound/list-indication-origins.port.ts` |
| Nested body the HTTP slice will wrap | design §9 catalog JSON |
| Next slice | [`04-http-and-contract.md`](./04-http-and-contract.md) |
