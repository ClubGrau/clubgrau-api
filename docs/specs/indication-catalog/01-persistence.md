# Spec: Slice 1 — Persistence (origins collection)

> Mongo adapter for origins. One collection, one repository.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md) (`IndicationOriginNameTakenError`, `IndicationOriginSnapshot`, availability port). Does **not** depend on [`02-commands.md`](./02-commands.md).  
> Design §10 / [ADR 0002](../../adr/indication-catalog/0002-canal-is-born-empty.md).  
> Next: [`02-commands.md`](./02-commands.md) and, in parallel after this slice, [`03-query.md`](./03-query.md).

## Responsibility (this spec only)

Store origins. Translate a duplicate `(categoryId, nameKey)` into `IndicationOriginNameTakenError`. Derive `active` on the read row. Do not seed. Do not add a category collection.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Snapshot, errors, availability port |
| **This file** | Schema, mapper, repository, outbound ports the repository implements |
| [`02`](./02-commands.md) | Use cases call insert / find / update / `nextPosition`. They do not talk to Mongoose |
| [`03`](./03-query.md) | Query calls `list` only |

Paths below are under `src/modules/indications/`.

## When to use this spec

The use cases do not exist yet. Add the repository methods anyway, behind ports, so slice 2 and slice 3 can bind the same class.

| Artifact | This slice? |
|----------|-------------|
| `indication-origin.schema.ts` | Yes |
| Mapper | Yes |
| `IndicationOriginMongooseRepository` + spec | Yes |
| `IndicationOriginRepositoryPort` (write) | Yes |
| `ListIndicationOriginsPort` + catalog row type | Yes — `list` is a §10 method; slice 3 must not redefine it |
| Repository implements `IndicationOriginNameAvailabilityPort` | Yes |
| Use cases / controllers / `indications.module.ts` / `app.ts` / `AGENT.md` | **No** |
| Seed / boot insert / category model | **No** |
| `toJSON()` as a write | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of the Indication Catalog following [`docs/specs/indication-catalog/01-persistence.md`](./01-persistence.md).  
> One origins collection. Unique `(categoryId, nameKey)`. `11000` → `IndicationOriginNameTakenError`. `list` rows have no intervals and no `nameKey`.  
> Do not add use cases, controllers, or a seed.

## Schema

File: `infrastructure/outbound/persistence/indication-origin.schema.ts`.

Model name `IndicationOrigin`. Explicit collection `origins` (do not leave Mongoose’s default `indicationorigins`).

```ts
{
  categoryId: 'canal' | 'campanha'   // required enum; amigo is not a stored value
  name: string                       // required
  nameKey: string                    // required
  position: number                   // required
  createdAt: Date                    // required
  intervals: [{ from: Date, to: Date | null }]   // required, at least the schema allows an array
}
```

**Index:** unique `{ categoryId: 1, nameKey: 1 }`.

No unique index on `position`. No `active` path. No `bornKey`. No `timestamps: true` (that would add `updatedAt` and a second writer of `createdAt`). No category collection. No interval collection.

`categoryId: 'amigo'` fails schema validation in the adapter. Let that validation error propagate. Do not translate it into `IndicationCategoryDoesNotHoldOriginsError` (the domain already refused Amigo before a normal insert).

## Ports

### Write — `application/ports/outbound/indication-origin-repository.port.ts`

```ts
interface IndicationOriginRepositoryPort {
  insert(snapshot: IndicationOriginSnapshot): Promise<{ id: string }>
  updateName(params: { id: string; name: string; nameKey: string }): Promise<void>
  updateIntervals(params: {
    id: string
    intervals: IndicationOriginInterval[]
  }): Promise<void>
  nextPosition(categoryId: 'canal' | 'campanha'): Promise<number>
  findById(id: string): Promise<IndicationOriginSnapshot | null>
}
```

`existsByNameKey` stays on the **domain** port from slice 0. Do not copy it onto this write port. The repository class implements both.

### Read — `application/ports/outbound/list-indication-origins.port.ts`

```ts
type IndicationOriginCatalogRow = {
  id: string
  categoryId: 'canal' | 'campanha'
  name: string
  position: number
  active: boolean
}

interface ListIndicationOriginsPort {
  list(): Promise<IndicationOriginCatalogRow[]>
}
```

The row has no `intervals`, no `nameKey`, no `createdAt`. `active` is derived in the repository from the last interval: `to === null` → `true`. Empty `intervals` → `active: false` (do not throw on the read).

## Mapper

File: `infrastructure/outbound/persistence/indication-origin.mapper.ts`.

Mongoose types stay in this file.

| Direction | Rule |
|-----------|------|
| Snapshot → document | `_id` is `ObjectId` from `snapshot.id`. Copy `categoryId`, `name`, `nameKey`, `position`, `createdAt`, `intervals`. Do not call `toJSON()` |
| Document → snapshot | `id` is `String(_id)`. Dates stay `Date`. `to: null` stays null |
| Document → catalog row | `active` from the last interval only. Omit `intervals` and `nameKey` |

## Repository

File: `infrastructure/outbound/persistence/indication-origin-mongoose.repository.ts`.

```ts
class IndicationOriginMongooseRepository
  implements
    IndicationOriginRepositoryPort,
    ListIndicationOriginsPort,
    IndicationOriginNameAvailabilityPort
```

Constructor takes the Mongoose model only.

| Method | Behaviour |
|--------|-----------|
| `insert` | `create` the mapped snapshot. Return `{ id }` equal to `snapshot.id` (the entity id), not a newly generated one. Mongo `11000` → `IndicationOriginNameTakenError`. Any other rejection propagates |
| `updateName` | `updateOne({ _id: id }, { $set: { name, nameKey } })`. No other keys in `$set`. `11000` → the same name-taken error |
| `updateIntervals` | `updateOne({ _id: id }, { $set: { intervals } })`. No other keys in `$set` |
| `existsByNameKey` | `findOne` / `exists` on `categoryId` + `nameKey`. No interval filter. When `exceptOriginId` is present, `_id: { $ne: exceptOriginId }`. Return boolean |
| `nextPosition` | max `position` for that `categoryId`, plus 1. `1` when none. Not unique. Two callers can read the same max; that is accepted |
| `findById` | write load, including `intervals` and `nameKey`. Miss → `null`. Invalid id (cast error) → `null`, same as `EmployeeMongooseRepository.findById` |
| `list` | every origin, active and ended. Map to catalog rows. Do not sort here; slice 3 sorts |

### 0-document update

`updateName` and `updateIntervals`: `matchedCount === 0` → throw a non-domain `Error`. The use case already loaded the origin; this is a race or a bad id. Do **not** throw `IndicationOriginNotFoundError` (that is `400` on load). Do **not** resolve as success.

`matchedCount === 1` and `modifiedCount === 0` → resolve.

### Duplicate key

Detect Mongo duplicate key (`code === 11000`) on `insert` and `updateName` only. Translate to `IndicationOriginNameTakenError`. Do not translate a validation error or a non-11000 failure into that class.

## Files

| File | Action |
|------|--------|
| `infrastructure/outbound/persistence/indication-origin.schema.ts` | Create |
| `infrastructure/outbound/persistence/indication-origin.mapper.ts` | Create |
| `infrastructure/outbound/persistence/indication-origin-mongoose.repository.ts` + `*.spec.ts` | Create |
| `application/ports/outbound/indication-origin-repository.port.ts` | Create |
| `application/ports/outbound/list-indication-origins.port.ts` | Create |
| Use cases / controllers / module / `app.ts` / `AGENT.md` | Do not create |

## Spec expectations (`indication-origin-mongoose.repository.spec.ts`)

Same `makeSut` + `makeChainableMock` style as `customer-mongoose.repository.spec.ts`. `afterEach` → `jest.restoreAllMocks()`. Do not boot the app. Do not add a parallel `__tests__` tree.

Schema files are coverage-excluded. Still assert the index and the collection from this spec by importing the schema. Do not move repository logic into the schema to “cover” it.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `IndicationOriginMongooseRepository` |
| collection | schema collection option is `origins` |
| unique index | `{ categoryId: 1, nameKey: 1 }` unique. No unique index whose key is `position` |
| `categoryId` enum | `canal` and `campanha` only |
| `insert` | payload `_id` matches the snapshot id; fields are the snapshot primitives; result `{ id }` is that id |
| `insert` `11000` | rejects `IndicationOriginNameTakenError` |
| `insert` other error | rejects that error, not name-taken |
| `updateName` | `$set` deep-equals `{ name, nameKey }`; filter `{ _id: id }` |
| `updateName` `11000` | `IndicationOriginNameTakenError` |
| `updateName` `matchedCount === 0` | throws `Error`, not `IndicationOriginNotFoundError` |
| `updateName` `matchedCount === 1`, `modifiedCount === 0` | resolves |
| `updateIntervals` | `$set` deep-equals `{ intervals }` only |
| `updateIntervals` `matchedCount === 0` | throws `Error`, not `IndicationOriginNotFoundError` |
| `existsByNameKey` | filter is `categoryId` + `nameKey` and has no `intervals` predicate |
| `existsByNameKey` with `exceptOriginId` | filter includes `_id: { $ne: exceptOriginId }` |
| `existsByNameKey` hit / miss | `true` / `false` |
| `nextPosition` none | `1` |
| `nextPosition` max 4 | `5` |
| `findById` hit | snapshot includes `intervals` and `nameKey` |
| `findById` miss / invalid id | `null` |
| `list` open last interval | row `active: true`; result has no `intervals` and no `nameKey` |
| `list` closed last interval | `active: false` |
| `list` last closed after an older open interval | `active` follows the **last** element only |
| `list` does not drop ended rows | a closed origin is still in the array |

No test inserts a category document. No test calls a seed.

## Checklist (agent)

- [ ] One model, collection `origins`
- [ ] Unique `(categoryId, nameKey)`; `amigo` is not an enum value
- [ ] No seed, no category repository, no `active` column
- [ ] `insert` / `updateName` map only `11000` to `IndicationOriginNameTakenError`
- [ ] `updateName` and `updateIntervals` `$set` only their own keys
- [ ] Writes use the snapshot mapper, not `toJSON()`
- [ ] `list` rows are `id`, `categoryId`, `name`, `position`, `active`
- [ ] `existsByNameKey` does not filter ended origins
- [ ] `nextPosition` is max + 1, or `1`
- [ ] 0-match update throws a non-domain `Error`
- [ ] Repository spec covers the table
- [ ] No use case, controller, module, or `AGENT.md`

## Out of scope

- Create / correct / end / reopen orchestration
- Grouping rows under the three categories (slice 3)
- HTTP
- A transaction around `nextPosition`

## Acceptance criteria

- [ ] Fresh collection is empty; nothing in this slice inserts on import
- [ ] `insert` of two snapshots with the same `categoryId` + `nameKey` surfaces `IndicationOriginNameTakenError` when the driver returns `11000`
- [ ] The same `nameKey` in the other `categoryId` is not a duplicate of that index
- [ ] `updateName` does not write `intervals`, `position`, `categoryId`, or `createdAt`
- [ ] `updateIntervals` does not write `name` or `nameKey`
- [ ] `list` includes an ended origin with `active: false` and without `intervals`
- [ ] `nextPosition` on an empty category is `1`
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Model + mapper + repository shape | `customers/infrastructure/outbound/persistence/` |
| Invalid id → `null` | `EmployeeMongooseRepository.findById` |
| Chainable model mock | `makeChainableMock` in `@configs/database/mongoose` |
| Why Canal is empty | [ADR 0002](../../adr/indication-catalog/0002-canal-is-born-empty.md) |
| Next slices | [`02-commands.md`](./02-commands.md), [`03-query.md`](./03-query.md) |
