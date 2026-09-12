# Spec: Slice 1 — Persistence (`updateMainData` `$set` esparso)

> Mongo adapter for a sparse Main Data write.  
> Parent: [`README.md`](./README.md).  
> Depends on: none of the domain slice (the port is typed without the entity). Prefer landing after or with the port file only.  
> Design §10.  
> Jira: [KAN-22](https://paulodevmais.atlassian.net/browse/KAN-22).  
> Next: [`02-usecase.md`](./02-usecase.md).

## Responsibility (this spec only)

Persist only the Main Data keys **present** on the command. Create still inserts a full document; lifecycle already `$set`s only what it owns. This slice adds the same `$set`-only rule for identity fields.

| Spec | Responsibility |
|------|----------------|
| [`00-domain.md`](./00-domain.md) | Entity / policy (unused here) |
| **This file** | Application outbound port + repository method + spec |
| [`02-usecase.md`](./02-usecase.md) | Use case builds the present-key payload |
| Schema / mapper / read model | **Unchanged** |

## When to use this spec

Use this document to extend **outbound persistence only**. The use case does not exist yet — still add the repository method so slice 2 can bind the port to the same class.

| Artifact | This slice? |
|----------|-------------|
| `UpdateMainEmployeeDataRepositoryPort` | Yes |
| `EmployeeMongooseRepository.updateMainData` | Yes |
| Schema / indexes | **No** — unique `email` stays |
| Mapper / `toCreate` / list read model | **No** |
| Use case / occupancy / HTTP / module factory | **No** |
| `toJSON()` as a write | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Update Main Employee Data following [`docs/specs/update-main-employee-data/01-persistence.md`](./01-persistence.md).  
> Add `UpdateMainEmployeeDataRepositoryPort` and `updateMainData` on `EmployeeMongooseRepository`. `$set` only present keys; `username: null` persists.  
> No schema migration. Do not write `toJSON()`. Do not add the use case.

## Application port

File: `application/ports/outbound/update-main-employee-data-repository.port.ts`.

```ts
export interface UpdateMainEmployeeDataParams {
  id: string
  name?: string
  email?: string
  phone?: string
  username?: string | null
}

export interface UpdateMainEmployeeDataRepositoryPort {
  updateMainData(params: UpdateMainEmployeeDataParams): Promise<void>
}
```

Presence = key is not `undefined` on `params`. `username: null` is present (clear). Omitted keys are absent from `$set`.

## Repository

Same `EmployeeMongooseRepository`. Implement:

```ts
async updateMainData(params: UpdateMainEmployeeDataParams): Promise<void> {
  const { id, ...fields } = params
  const $set = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  )
  const result = await this.employeeModel.updateOne({ _id: id }, { $set })
  if (result.matchedCount === 0) {
    throw new Error('Employee main data update matched 0 documents')
  }
}
```

Equivalent hand-built `$set` is fine (copy only defined keys). Do **not** `$unset`. Do **not** write `password`, `status`, `role`, `deactivateAt`, `removedAt`, or personal/professional fields.

| Key on params | `$set` |
|---------------|--------|
| omitted | not in `$set` |
| `name` / `email` / `phone` string | that field |
| `username: null` | `username: null` |
| `username: "jdoe"` | `username: "jdoe"` |

### 0-document write

Use case (slice 2) already loaded the Target. A `matchedCount === 0` after that load is a race (deleted between load and write) or a bad id. **Throw** a non-domain `Error` so slice 3 maps it to `500`. Do **not** throw `EmployeeNotFoundError` (that is `400` for a Target miss on load). Do **not** resolve as a silent success.

Invalid ObjectId: `updateOne` typically matches 0 — same throw. `findById` already returns `null` for invalid ids; this method must not swallow the miss.

`modifiedCount === 0` with `matchedCount === 1` (same values) is success — do not throw.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/update-main-employee-data-repository.port.ts` | Create |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | `updateMainData` |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover `$set` presence + 0-match |
| `employee.schema.ts` / mapper / controllers / use cases / `app.ts` | Do not change |

## Spec expectations (`employee-mongoose.repository.spec.ts`)

Same `makeSut` / `updateOne` spy harness as `updateStatus` / `anonymize`.

| `it(...)` | Assert |
|-----------|--------|
| `{ id, name }` `$set` is only `{ name }` | no `email` / `phone` / `username` / `password` / `status` |
| `{ id, username: null }` `$set` includes `username: null` | present-and-null is not omitted |
| omitted `username` | `$set` has no `username` key |
| `{ id, name, email, phone, username }` `$set` has those four only | no `role` / `deactivateAt` / `removedAt` |
| `matchedCount === 0` | throws (not `EmployeeNotFoundError`) |
| `matchedCount === 1` and `modifiedCount === 0` | resolves |
| `updateOne` filter is `{ _id: id }` | same as `updateStatus` |

Do not add a parallel `__tests__` tree. Schema files are coverage-excluded; do not move logic into the schema.

## Checklist (agent)

- [ ] Port lives under `application/ports/outbound/`
- [ ] `$set` contains only keys `!== undefined`
- [ ] `username: null` is written; omitted `username` is not
- [ ] No `toJSON()` / full replace
- [ ] 0-match throws unexpected (not silent `200`, not `EmployeeNotFoundError`)
- [ ] Same-value write (`matchedCount === 1`) succeeds
- [ ] Repository spec updated; existing `updateStatus` / `anonymize` cases still pass
- [ ] No HTTP / use case / policy wiring in this slice

## Out of scope

- Occupancy
- Reconstitute / mutators
- Route / controller
- Unique-index migration
- Changing `findById` / `findByEmail`

## Acceptance criteria

- [ ] `{ id, name }` does not rewrite `email` / `phone` / `username` / `password` / `status`
- [ ] `{ id, username: null }` persists `username: null`
- [ ] Omitted `username` leaves the stored username untouched
- [ ] No `toJSON()` / full replace
- [ ] 0-document `$set` throws
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| `$set`-only siblings | `updateStatus` / `anonymize` on `EmployeeMongooseRepository` |
| Schema today (do not change) | `infrastructure/outbound/persistence/employee.schema.ts` |
| Next slice | [`02-usecase.md`](./02-usecase.md) |
