# Spec: Slice 0 — Domain (categories, origin, name policy)

> Pure domain of the Indication Catalog.  
> Parent: [`README.md`](./README.md).  
> Depends on: none. Shared `Name` and `UniqueEntityId` already exist.  
> Design §7 / [ADR 0001](../../adr/indication-catalog/0001-categories-are-a-closed-code-set.md) / [ADR 0003](../../adr/indication-catalog/0003-active-time-is-an-interval-list.md) / [ADR 0004](../../adr/indication-catalog/0004-reserved-name-is-a-name-key.md).  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give the new hexagon its categories, the origin entity, the name-reservation rule, and the errors later slices map to HTTP. Nothing is stored yet.

| Spec | Responsibility |
|------|----------------|
| **This file** | Closed category set, `IndicationOrigin`, errors, name policy + availability port + specs |
| [`01-persistence.md`](./01-persistence.md) | Mongo adapter implements the availability port and the write/read methods |
| [`02-commands.md`](./02-commands.md) | Use cases call `find`, `create` / `reconstitute`, the policy, `end` / `reopen` / `correctName` |
| [`03-query.md`](./03-query.md) | Query calls `IndicationCategories.list` only. It does not reconstitute |
| [`04-http-and-contract.md`](./04-http-and-contract.md) | Controllers map the errors. `requireRoles` is the role gate |

Paths below are under `src/modules/indications/`.

## When to use this spec

Use this document to add **domain only** (`domain/` + co-located specs).

| Artifact | This slice? |
|----------|-------------|
| `IndicationCategories` | Yes |
| `IndicationOrigin` (`create`, `reconstitute`, `correctName`, `end`, `reopen`, `nameKeyFrom`, `toPersistence`) | Yes |
| Domain errors | Yes |
| `IndicationOriginNamePolicy` + `IndicationOriginNameAvailabilityPort` + specs | Yes |
| Schema / repository / use cases / query / HTTP / `app.ts` / `AGENT.md` | **No** |
| Seed of Instagram, TikTok, Google, or any campaign | **No** |
| A category entity, category repository, or `UniqueEntityId` for a category | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of the Indication Catalog following [`docs/specs/indication-catalog/00-domain.md`](./00-domain.md).  
> Add `IndicationCategories`, `IndicationOrigin`, the four indication errors, and `IndicationOriginNamePolicy`.  
> Do not add Mongo, use cases, controllers, routes, or a seed. Do not make category ids a `UniqueEntityId`.

## 1. `IndicationCategories`

File: `domain/indication-categories.ts` + co-located `indication-categories.spec.ts`.

Categories are a closed code set, same idea as `Role`. Not documents. Not an entity.

```ts
type IndicationCategoryId = 'canal' | 'campanha' | 'amigo'

type IndicationCategory =
  | { id: 'canal'; name: 'Canal'; order: 1; holdsOrigins: true }
  | { id: 'campanha'; name: 'Campanha'; order: 2; holdsOrigins: true }
  | { id: 'amigo'; name: 'Amigo'; order: 3; holdsOrigins: false }
```

`holdsOrigins` is a literal, so a `holdsOrigins === false` check narrows `id` to `'canal' | 'campanha'`. Slice 2 passes that narrowed id to `nextPosition` and `IndicationOrigin.create` without a cast.

| id | name | order | holdsOrigins |
|----|------|-------|----------------|
| `canal` | Canal | 1 | true |
| `campanha` | Campanha | 2 | true |
| `amigo` | Amigo | 3 | false |

```ts
IndicationCategories.list(): IndicationCategory[]   // three items, sorted by order
IndicationCategories.find(id: string): IndicationCategory | undefined
```

`find` returns the category or nothing. It does **not** throw. Callers (slice 2) treat “nothing” and “`holdsOrigins === false`” as different errors. A magic check on the string `'amigo'` is not the rule; `holdsOrigins` is.

Export `IndicationCategoryId` from this file. Category ids are **codes**. `UniqueEntityId` accepts only 24-character hex and must not be used for `canal` / `campanha` / `amigo`.

No fourth category. No rename. No `bornKey`. No seed helper.

## 2. Snapshot types

File: `domain/models/indication-origin.model.ts`.

The model file does **not** import the entity (avoid a cycle). The entity imports these types.

```ts
type IndicationOriginInterval = {
  from: Date
  to: Date | null
}

type IndicationOriginSnapshot = {
  id: string
  categoryId: 'canal' | 'campanha'   // amigo is not a stored value
  name: string
  nameKey: string
  position: number
  createdAt: Date
  intervals: IndicationOriginInterval[]
}
```

`active` is not a field on the snapshot. It is derived from the last interval.

Do not type this snapshot as `ReturnType<IndicationOrigin['toJSON']>`. Slice 1 persists `toPersistence()`, not `toJSON()`.

## 3. `IndicationOrigin`

File: `domain/entities/IndicationOrigin.ts` + co-located `indication-origin.spec.ts`.

Extends shared `Entity`. Origin ids are `UniqueEntityId` (generated on `create`, restored on `reconstitute`).

```ts
static nameKeyFrom(name: Name): string

static create(input: {
  categoryId: 'canal' | 'campanha'
  name: Name
  position: number
}): IndicationOrigin

static reconstitute(input: {
  id: string
  categoryId: 'canal' | 'campanha'
  name: Name
  nameKey: string
  position: number
  createdAt: Date
  intervals: IndicationOriginInterval[]
}): IndicationOrigin

correctName(name: Name): boolean
end(): boolean
reopen(): boolean
toPersistence(): IndicationOriginSnapshot
```

Getters used by later slices: `categoryId`, `name` (`Name`), `nameKey`, `position`, `createdAt`, `intervals` (a copy), `active`.

`nameKeyFrom` is `name.value.toLowerCase()`. Unicode default case fold. Not `toLocaleLowerCase`. Accents stay distinct: the PRD only folds case.

### `create`

- `createdAt = new Date()` once.
- One open interval `{ from: createdAt, to: null }`. The same `Date` instance is the entity `createdAt` and the first `from`.
- `nameKey = nameKeyFrom(name)`.
- Stores `categoryId`, `name`, and `position` as given. The entity does not compute max position and does not check `holdsOrigins` (slice 2 does that before `create`).
- Does not accept `amigo`. The parameter type is `'canal' | 'campanha'`.

### `reconstitute`

Rebuilds a stored origin. Does **not** call `create` (that would open a new interval and stamp a new `createdAt`).

- Keeps the stored `nameKey`. Does not recompute it from `name`.
- Keeps `createdAt` and `intervals` as given.
- `intervals` empty → throw a non-domain `Error`. An origin always has at least one interval. This is not a new error class and not a `400`.
- `categoryId` other than `canal` | `campanha` → throw a non-domain `Error`.

### `correctName`

Returns `false` when `nameKeyFrom(name)` equals the current `nameKey`. On `false`, do not change `name`, `nameKey`, `categoryId`, `position`, `createdAt`, or `intervals`.

Case-only and spacing-only input is this `false` path. `Name.create` already trimmed and collapsed spaces before the entity sees the value. `"Instagram"` corrected with `Name` `"instagram"` returns `false` and the stored display stays `"Instagram"`. Do not write a display-case change when the key is unchanged.

Returns `true` when the key changes. Then set `name` and `nameKey` only.

### `end` and `reopen`

Both stamp `new Date()` inside the entity, the same way `Employee` stamps `deactivateAt`.

| Method | Already in that state | Effect | Return |
|--------|----------------------|--------|--------|
| `end` | last interval `to !== null` | array unchanged | `false` |
| `end` | last interval `to === null` | set that interval’s `to` to `new Date()`. Do not append. Do not change `from` or `createdAt` | `true` |
| `reopen` | last interval `to === null` | array unchanged | `false` |
| `reopen` | last interval `to !== null` | append `{ from: new Date(), to: null }` | `true` |

`active` is `intervals.at(-1).to === null`. There is no stored `active` flag.

`end` and `reopen` do not change `name`, `nameKey`, `categoryId`, `position`, or `createdAt`.

### `toPersistence`

Returns the snapshot: `id`, `categoryId`, `name` (`Name.value`), `nameKey`, `position`, `createdAt`, `intervals` (copies of `{ from, to }`). No `active`. Later slices must not persist `toJSON()`.

## 4. Domain errors

File: `domain/errors/indication.errors.ts`.

Same style as `EmployeeNotFoundError`: extend `DomainError`, fixed message in the constructor. Controllers (slice 4) map **class → HTTP**, not message text.

| Class | Message | Typical HTTP (slice 4) |
|-------|---------|------------------------|
| `IndicationCategoryUnknownError` | `Indication category is unknown` | `400` |
| `IndicationCategoryDoesNotHoldOriginsError` | `Indication category does not hold origins` | `400` |
| `IndicationOriginNotFoundError` | `Indication origin not found` | `400` |
| `IndicationOriginNameTakenError` | `Indication origin name is already reserved` | `409` |

`InvalidNameError` stays the shared `Name` error. Do not wrap it.

Do not add a role error. `requireRoles` is the gate.

## 5. `IndicationOriginNamePolicy`

Files:

- `domain/ports/indication-origin-name-availability.port.ts`
- `domain/services/indication-origin-name.policy.ts` + co-located spec

The class name is an implementation detail, not a glossary term. Same shape as `EmployeePoliciesService.ensureEmailIsAvailable`: the domain asks a port, then throws one error.

```ts
interface IndicationOriginNameAvailabilityPort {
  existsByNameKey(input: {
    categoryId: IndicationCategoryId
    nameKey: string
    exceptOriginId?: string
  }): Promise<boolean>
}

class IndicationOriginNamePolicy {
  constructor(availability: IndicationOriginNameAvailabilityPort)

  ensureAvailable(input: {
    categoryId: IndicationCategoryId
    nameKey: string
    exceptOriginId?: string
  }): Promise<void>
}
```

- Port returns `true` → throw `IndicationOriginNameTakenError`.
- Port returns `false` → resolve.
- Pass `exceptOriginId` through only when the caller provided it. Do not invent an empty exclusion.
- The port input has no `active` flag and no interval filter. Ended origins count because the query does not exclude them. The policy does not know about intervals.
- Do not catch a duplicate-key driver error here. That translation is the repository (slice 1), and it throws this same class.

No Express, Mongoose, or HTTP.

## Files

| File | Action |
|------|--------|
| `domain/indication-categories.ts` + `*.spec.ts` | Create |
| `domain/models/indication-origin.model.ts` | Create |
| `domain/entities/IndicationOrigin.ts` + `*.spec.ts` | Create |
| `domain/errors/indication.errors.ts` | Create |
| `domain/ports/indication-origin-name-availability.port.ts` | Create |
| `domain/services/indication-origin-name.policy.ts` + `*.spec.ts` | Create |
| Schema / repository / use cases / HTTP / `AGENT.md` | Do not create |

## Spec expectations

### `indication-categories.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `list` length and order | `canal`, `campanha`, `amigo`; `order` 1, 2, 3; names `Canal`, `Campanha`, `Amigo` |
| `holdsOrigins` | `true`, `true`, `false` |
| `find('canal' \| 'campanha' \| 'amigo')` | the matching category |
| `find('instagram')` / `find('')` | `undefined` (no throw) |
| ids are codes | `new UniqueEntityId('canal')` throws `InvalidUniqueEntityIdError` |

### `indication-origin.spec.ts`

`makeSut` builds via `create` unless the case says `reconstitute`. `jest.useFakeTimers()` when asserting stamped dates. `afterEach` → `jest.useRealTimers()` and `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `IndicationOrigin` |
| `create` | one interval `{ from: createdAt, to: null }`; `active === true`; `nameKey === name.value.toLowerCase()`; `id` matches `/^[0-9a-f]{24}$/` |
| `nameKeyFrom` | `Name.create('Verão')` → `'verão'`; `Name.create('Verao')` → `'verao'` (distinct); `Name.create('I')` → `'i'` |
| `correctName` to a different key | `true`; `name` and `nameKey` change; `categoryId`, `position`, `createdAt`, intervals unchanged |
| `correctName` same key, different case | `Name` `'instagram'` against stored `'Instagram'` → `false`; display stays `'Instagram'`; `nameKey` stays `'instagram'` |
| `correctName` same key after collapsed spaces | stored `'Google Ads'`, `Name.create('Google  Ads')` → `false`; no field changes |
| `end` on an open origin | `true`; last `to` equals the fake now; `from` and `createdAt` unchanged; `active === false`; still one interval |
| `end` again | `false`; interval array deep-equals the previous one (same `to`) |
| `reopen` after end | `true`; appends `{ from: now, to: null }`; previous interval unchanged; `active === true`; `createdAt` unchanged |
| `reopen` on an open origin | `false`; no extra interval |
| `reconstitute` | does not replace `createdAt` or the stored intervals; `nameKey` is the snapshot’s, even if it were recomputed differently |
| `reconstitute` empty intervals | throws `Error`; not `IndicationOriginNotFoundError` |
| `toPersistence` | plain snapshot; `name` is a string; no `active` key; mutating the returned `intervals` does not change a later `toPersistence()` |

Do not add a test that `create` accepts `amigo`. The type forbids it.

### `indication-origin-name.policy.spec.ts`

Stub `IndicationOriginNameAvailabilityPort`. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `IndicationOriginNamePolicy` |
| port resolves `false` | `ensureAvailable` resolves; port called with `{ categoryId, nameKey }` and no `exceptOriginId` key |
| port resolves `true` | `IndicationOriginNameTakenError` |
| `exceptOriginId` provided | forwarded on the port input |
| port input | has no `active` and no `intervals` |

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] Three categories, fixed order, `holdsOrigins` true / true / false
- [ ] Category ids are codes, not `UniqueEntityId`
- [ ] `nameKeyFrom` is `String#toLowerCase` (accents stay distinct)
- [ ] `create` opens one interval at `createdAt`; `reconstitute` does not
- [ ] `correctName` / `end` / `reopen` return `false` without changing state when already in the requested state
- [ ] Case-only correct does not change the stored display name
- [ ] `active` is derived from the last interval
- [ ] Policy throws `IndicationOriginNameTakenError` and does not filter ended origins
- [ ] Co-located specs cover the tables
- [ ] No schema, repository, use case, query, HTTP, or `AGENT.md`

## Out of scope

- Mongo unique index and `11000`
- `nextPosition`
- Use cases and the catalog query
- HTTP status codes (the table above is the later map, not this slice’s job)
- Role checks

## Acceptance criteria

- [ ] `list()` is Canal, Campanha, Amigo, in that order, with `holdsOrigins` true, true, false
- [ ] Unknown category id → `find` returns nothing and does not throw
- [ ] `create` yields an active origin whose first `from` is `createdAt` and whose `nameKey` is the lowercased name
- [ ] `correctName` to another key changes only `name` and `nameKey`; the same key (any case) changes nothing
- [ ] `end` closes the open interval; a second `end` returns `false` and keeps the same `to`
- [ ] `reopen` appends an open interval; a second `reopen` returns `false`
- [ ] `reconstitute` preserves `createdAt`, `nameKey`, and intervals
- [ ] Policy: taken key throws `IndicationOriginNameTakenError`; free key resolves; `exceptOriginId` is forwarded
- [ ] Domain specs pass without Mongo

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/indications/CONTEXT.md` |
| Entity base / id | `@shared/domain` `Entity`, `UniqueEntityId` |
| Name ruler (do not reimplement) | `@shared/domain` `Name` |
| Occupancy sibling | `employees/domain/services/employee-policies.service.ts` |
| Clock inside the entity | `Employee` `deactivate` / `remove` stamping `new Date()` |
| Why categories are codes | [ADR 0001](../../adr/indication-catalog/0001-categories-are-a-closed-code-set.md) |
| Why intervals | [ADR 0003](../../adr/indication-catalog/0003-active-time-is-an-interval-list.md) |
| Why `nameKey` | [ADR 0004](../../adr/indication-catalog/0004-reserved-name-is-a-name-key.md) |
| Next slice | [`01-persistence.md`](./01-persistence.md) |
