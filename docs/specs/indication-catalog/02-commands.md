# Spec: Slice 2 — Commands (create, correct the name, end, reopen)

> Application commands. Four use cases, one origin repository.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), [`01-persistence.md`](./01-persistence.md).  
> Design §8.1–§8.3.  
> Next: [`04-http-and-contract.md`](./04-http-and-contract.md). Slice [`03-query.md`](./03-query.md) does not depend on this file.

## Responsibility (this spec only)

Orchestrate the four writes. The name policy and the entity decide the rules. The repository persists the narrow patch. A no-op does not write.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Categories, entity, policy, errors |
| [`01`](./01-persistence.md) | `IndicationOriginRepositoryPort` + availability adapter |
| **This file** | DTOs, inbound ports, snapshot mapper, four use cases + specs |
| [`03`](./03-query.md) | Read path — do not call it from these use cases |
| [`04`](./04-http-and-contract.md) | Controllers, routes, module |

Paths below are under `src/modules/indications/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| Four DTOs + four inbound ports | Yes |
| `reconstituteIndicationOrigin` mapper | Yes |
| Four use cases + specs | Yes |
| Controller / routes / `indications.module.ts` / `app.ts` / `AGENT.md` / `.http` | **No** |
| A second write-port interface | **No** — use `IndicationOriginRepositoryPort` from slice 1 |
| `actorId` on the DTOs | **No** — use cases do not load an actor |

**Prompt sketch for the agent:**

> Implement slice 2 of the Indication Catalog following [`docs/specs/indication-catalog/02-commands.md`](./02-commands.md).  
> Create, correct the name, end, and reopen. No-op correct, end, and reopen return `{ id }` and do not write.  
> Do not add controllers, routes, or `app.ts`. Do not put `actorId` on the DTOs.

## Shared rules

- Inject ports. Do not construct Mongoose, the policy’s repository, or `IndicationCategories` as a class instance. `IndicationCategories` and `IndicationOrigin` are called as the domain API from slice 0.
- DTOs have no `actorId`. If a later controller forwards one, these use cases do not read it.
- `Name.create` is the only name ruler. Do not trim again in the use case.
- Never persist `toJSON()`. Insert uses `toPersistence()`. Correct uses `updateName`. End and reopen use `updateIntervals`.
- If a step throws, do not call the write that would have followed.
- `insert` / `updateName` already throw `IndicationOriginNameTakenError` on `11000`. Let it propagate. Do not catch and wrap it.

### Reconstitute mapper

File: `application/mappers/indication-origin-snapshot.mapper.ts`.

```ts
function reconstituteIndicationOrigin(
  snapshot: IndicationOriginSnapshot,
): IndicationOrigin
```

`Name.create(snapshot.name)`, then `IndicationOrigin.reconstitute` with the stored `nameKey`, `createdAt`, and `intervals`. Never `IndicationOrigin.create` on this path (`create` would open a new interval).

Used by correct, end, and reopen. Not by the catalog query.

## 1. Create

### DTO — `application/dtos/create-indication-origin.dto.ts`

```ts
interface CreateIndicationOriginDto {
  categoryId: string
  name: string
}

interface CreateIndicationOriginResultDto {
  id: string
}
```

### Inbound — `application/ports/inbound/create-indication-origin.port.ts`

```ts
interface CreateIndicationOriginPort {
  execute(params: CreateIndicationOriginDto): Promise<CreateIndicationOriginResultDto>
}
```

### Use case — `application/usecases/create-indication-origin.usecase.ts`

```ts
constructor(
  namePolicy: IndicationOriginNamePolicy,
  origins: IndicationOriginRepositoryPort,
)
```

```text
execute({ categoryId, name })
  1. category = IndicationCategories.find(categoryId)
       undefined → IndicationCategoryUnknownError
  2. category.holdsOrigins === false → IndicationCategoryDoesNotHoldOriginsError
  3. Name.create(name) → nameKey = IndicationOrigin.nameKeyFrom(name)
  4. namePolicy.ensureAvailable({ categoryId: category.id, nameKey })
       no exceptOriginId
  5. position = origins.nextPosition(category.id)
       step 2 narrowed id to 'canal' | 'campanha'; do not cast
  6. origin = IndicationOrigin.create({ categoryId: category.id, name, position })
  7. origins.insert(origin.toPersistence())
  8. return { id: origin.id }
```

The id returned is the entity id that `insert` stored as `_id`.

Do not call `ensureAvailable` for Amigo or for an unknown category: steps 1–2 throw first, and they do not write.

`nextPosition` runs only after the name is free. If `ensureAvailable` throws, `nextPosition` and `insert` are not called.

## 2. Correct the name

### DTO — `application/dtos/correct-indication-origin-name.dto.ts`

```ts
interface CorrectIndicationOriginNameDto {
  id: string
  name: string
}

interface CorrectIndicationOriginNameResultDto {
  id: string
}
```

### Inbound — `application/ports/inbound/correct-indication-origin-name.port.ts`

```ts
interface CorrectIndicationOriginNamePort {
  execute(
    params: CorrectIndicationOriginNameDto,
  ): Promise<CorrectIndicationOriginNameResultDto>
}
```

### Use case — `application/usecases/correct-indication-origin-name.usecase.ts`

```ts
constructor(
  namePolicy: IndicationOriginNamePolicy,
  origins: IndicationOriginRepositoryPort,
)
```

```text
execute({ id, name })
  1. origins.findById(id) — null → IndicationOriginNotFoundError
  2. origin = reconstituteIndicationOrigin(snapshot)
       never IndicationOrigin.create
  3. next = Name.create(name)
  4. origin.correctName(next) === false
       → return { id }
       → do not call ensureAvailable
       → do not call updateName
  5. namePolicy.ensureAvailable({
       categoryId: origin.categoryId,
       nameKey: origin.nameKey,
       exceptOriginId: id,
     })
  6. origins.updateName({ id, name: origin.name.value, nameKey: origin.nameKey })
  7. return { id }
```

Correcting an ended origin is allowed. The origin stays ended: `updateName` must not receive `intervals`.

The category does not change. `position` and `createdAt` are not in the patch.

`exceptOriginId` is what lets the origin keep a key it already holds while still refusing another origin’s key. The same-key path never reaches the policy (step 4).

## 3. End

### DTO — `application/dtos/end-indication-origin.dto.ts`

```ts
interface EndIndicationOriginDto {
  id: string
}

interface EndIndicationOriginResultDto {
  id: string
}
```

### Inbound — `application/ports/inbound/end-indication-origin.port.ts`

```ts
interface EndIndicationOriginPort {
  execute(params: EndIndicationOriginDto): Promise<EndIndicationOriginResultDto>
}
```

### Use case — `application/usecases/end-indication-origin.usecase.ts`

```ts
constructor(origins: IndicationOriginRepositoryPort)
```

No name policy.

```text
execute({ id })
  1. findById — null → IndicationOriginNotFoundError
  2. reconstitute
  3. origin.end() === false → return { id }; do not call updateIntervals
  4. origins.updateIntervals({ id, intervals: origin.intervals })
  5. return { id }
```

The intervals written are the entity’s after `end()`, not a hand-built `{ to: now }` in the use case. The clock stays inside the entity.

## 4. Reopen

Same shape as end, with `reopen()` and its own types.

Files:

- `application/dtos/reopen-indication-origin.dto.ts`
- `application/ports/inbound/reopen-indication-origin.port.ts`
- `application/usecases/reopen-indication-origin.usecase.ts` + spec

```text
execute({ id })
  1. findById — null → IndicationOriginNotFoundError
  2. reconstitute
  3. origin.reopen() === false → return { id }; do not call updateIntervals
  4. origins.updateIntervals({ id, intervals: origin.intervals })
  5. return { id }
```

Do not fold end and reopen into one use case with a flag. They are different commands.

## Files

| File | Action |
|------|--------|
| `application/dtos/create-indication-origin.dto.ts` | Create |
| `application/dtos/correct-indication-origin-name.dto.ts` | Create |
| `application/dtos/end-indication-origin.dto.ts` | Create |
| `application/dtos/reopen-indication-origin.dto.ts` | Create |
| `application/ports/inbound/create-indication-origin.port.ts` | Create |
| `application/ports/inbound/correct-indication-origin-name.port.ts` | Create |
| `application/ports/inbound/end-indication-origin.port.ts` | Create |
| `application/ports/inbound/reopen-indication-origin.port.ts` | Create |
| `application/mappers/indication-origin-snapshot.mapper.ts` | Create |
| `application/usecases/create-indication-origin.usecase.ts` + `*.spec.ts` | Create |
| `application/usecases/correct-indication-origin-name.usecase.ts` + `*.spec.ts` | Create |
| `application/usecases/end-indication-origin.usecase.ts` + `*.spec.ts` | Create |
| `application/usecases/reopen-indication-origin.usecase.ts` + `*.spec.ts` | Create |
| Controllers / routes / module / `AGENT.md` | Do not create |

## Spec expectations

`makeStubs` / `makeSut`. Stub `IndicationOriginRepositoryPort`. Use a **real** `IndicationOriginNamePolicy` over a stubbed availability port on create and correct, so a taken name is the domain error. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

Default availability stub: `existsByNameKey` resolves `false`. Default `nextPosition` resolves `1`. Default `findById` returns a canal snapshot with one open interval, `name: 'Instagram'`, `nameKey: 'instagram'`, `position: 1`.

### `create-indication-origin.usecase.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `CreateIndicationOriginUsecase` |
| unknown `categoryId` | `IndicationCategoryUnknownError`; availability, `nextPosition`, and `insert` not called |
| `categoryId: 'amigo'` | `IndicationCategoryDoesNotHoldOriginsError`; no availability, no `nextPosition`, no `insert` |
| name `' '` / `'a'` / 101 chars after normalize | `InvalidNameError`; no `insert` |
| `'Google  Ads'` | `insert` snapshot `name === 'Google Ads'` and `nameKey === 'google ads'` |
| `'Verão'` | `nameKey === 'verão'` |
| first in an empty category | `nextPosition('canal')`; snapshot `position === 1`; one open interval; `createdAt` equals that interval’s `from` |
| `nextPosition` returns `4` | snapshot `position === 4` |
| taken `nameKey`, any case | availability called with the lowercased key; `IndicationOriginNameTakenError`; no `insert` |
| same name, other category | availability called with `campanha`; `insert` runs when the port says free |
| `insert` rejects name-taken | use case rejects `IndicationOriginNameTakenError` (not wrapped) |
| success | `{ id }` equals snapshot id passed to `insert`; id matches `/^[0-9a-f]{24}$/` |
| constructor | policy + repository only |

### `correct-indication-origin-name.usecase.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `CorrectIndicationOriginNameUsecase` |
| `findById` null | `IndicationOriginNotFoundError`; no `updateName` |
| `findById` called with `id` | |
| same name, different case or spacing | `{ id }`; `existsByNameKey` not called; `updateName` not called |
| new free name | `updateName` `{ id, name, nameKey }` only (the object has no `intervals`, `position`, `categoryId`, `createdAt`); availability called with `exceptOriginId` |
| new name taken | `IndicationOriginNameTakenError`; no `updateName` |
| ended origin, new free name | `updateName` still only `{ id, name, nameKey }`; loaded intervals stay closed and are not written |
| invalid name | `InvalidNameError`; no `updateName` |
| `updateName` rejects name-taken | propagates |
| does not call `IndicationOrigin.create` | spy; `reconstitute` path only |
| constructor | policy + repository; no list port |

### `end-indication-origin.usecase.spec.ts`

Use fake timers so the closed `to` is assertable.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EndIndicationOriginUsecase` |
| miss | `IndicationOriginNotFoundError`; no `updateIntervals` |
| open origin | `updateIntervals` with one interval whose `to` is the fake now and whose `from` is unchanged; `{ id }` |
| already ended | `{ id }`; `updateIntervals` not called |
| patch | the payload has no `name` / `nameKey` / `position` / `categoryId` |
| constructor | repository only; policy not required |

### `reopen-indication-origin.usecase.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `ReopenIndicationOriginUsecase` |
| miss | `IndicationOriginNotFoundError`; no `updateIntervals` |
| ended origin | `updateIntervals` appends an open interval; the closed interval’s `to` is unchanged; `{ id }` |
| already open | `{ id }`; `updateIntervals` not called |
| constructor | repository only |

## Checklist (agent)

- [ ] Unknown category and Amigo fail on create before any write
- [ ] Create reserves the key, then takes `nextPosition`, then inserts `toPersistence()`
- [ ] Same `nameKey` in the other category is allowed when the port says free
- [ ] Correct to the same key does not call the policy and does not write
- [ ] Correct to a taken key does not write; the call included `exceptOriginId`
- [ ] Ended origin can be corrected; intervals are not in `updateName`
- [ ] Second end / second reopen does not call `updateIntervals`
- [ ] End and reopen write intervals from the entity
- [ ] No `actorId` on DTOs
- [ ] No `toJSON()` persist
- [ ] Co-located specs cover the tables
- [ ] No controller, route, module, or `AGENT.md`

## Out of scope

- HTTP presence checks and status codes
- `requireRoles`
- Catalog grouping
- Moving an origin to the other category
- Delete

## Acceptance criteria

- [ ] Create into a known holding category persists one open interval at `position` from `nextPosition` and returns that id
- [ ] Create `amigo` or an unknown category writes nothing
- [ ] Create with a taken `nameKey` (active or ended — the port does not say which) writes nothing
- [ ] `"Google  Ads"` is stored as `"Google Ads"`
- [ ] Correct keeps the id; the write is the new `name` + `nameKey` only, so the previous key is no longer this record’s
- [ ] Correct onto another origin’s key does not write
- [ ] Correct to the same name, including case and spacing, does not write
- [ ] End writes the closed intervals; a second end does not write
- [ ] Reopen writes an appended open interval; a second reopen does not write
- [ ] Unknown id on correct, end, and reopen is `IndicationOriginNotFoundError`
- [ ] Use-case specs pass

## Reference map

| Concern | Look at |
|---------|---------|
| Command + stubbed ports | `employees/application/usecases/create-employee.usecase.ts` |
| Reconstitute, not create | `Employee.reconstitute` callers in update-main |
| Name occupancy sibling | `EmployeePoliciesService.ensureEmailIsAvailable` |
| Write port | `application/ports/outbound/indication-origin-repository.port.ts` |
| Next slice | [`04-http-and-contract.md`](./04-http-and-contract.md) |
