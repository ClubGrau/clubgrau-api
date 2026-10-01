# Spec: Slice 1 — Persistence (`updateOwnData` + `findOwnEmployee`)

> Mongo adapter for one sparse own-data write and one password-free read.  
> Parent: [`README.md`](./README.md).  
> Depends on: none of the use case. The write port is typed with the same field set as `OwnEmployeeDataPersistPatch` from slice 0; the read port does not need the policy. Prefer landing after slice 0 so the patch type exists, or duplicate the field list on the port if the domain file is not merged yet — do not import the entity.  
> Design §10.  
> Jira: TBD.  
> Next: [`02-usecase.md`](./02-usecase.md) and, independently, [`03-query.md`](./03-query.md).

## Responsibility (this spec only)

Persist only the own-data keys **present** on the command, in one `updateOne`. Read one collaborator as `GetEmployeesItemDto` through `mapEmployeeReadModel`. `nif` on the write port is `string | null`; the schema type is `Number`, so this method coerces on write the same way `updatePersonalData` does.

| Spec | Responsibility |
|------|----------------|
| [`00-domain.md`](./00-domain.md) | Policy + patch service (unused here) |
| **This file** | Write port + `updateOwnData` + read port + `findOwnEmployee` + spec |
| [`02-usecase.md`](./02-usecase.md) | Use case builds the present-key payload and re-reads |
| [`03-query.md`](./03-query.md) | Query calls `findOwnEmployee` |
| Schema / list filter | **Unchanged** |

## When to use this spec

Use this document to extend **outbound persistence only**. The use case and the query do not exist yet — still add both methods so later slices bind the same repository instance.

| Artifact | This slice? |
|----------|-------------|
| `UpdateOwnEmployeeDataRepositoryPort` | Yes |
| `EmployeeMongooseRepository.updateOwnData` | Yes |
| `FindOwnEmployeePort` | Yes |
| `EmployeeMongooseRepository.findOwnEmployee` | Yes |
| Schema / indexes | **No** — the eight fields already exist |
| `mapEmployeeReadModel` / `mapEmployeeDocument` | **No** — call the existing read mapper; do not edit it |
| Use case / query / HTTP / module factory | **No** |
| `toJSON()` as a write | **No** |
| `updateMainData` / `updatePersonalData` | **No** — do not call them from `updateOwnData` |

**Prompt sketch for the agent:**

> Implement slice 1 of Update Own Employee Data following [`docs/specs/update-own-employee-data/01-persistence.md`](./01-persistence.md).  
> Add `updateOwnData` (one `$set`, non-null `nif` as `Number`, `username: null` persists, `matchedCount` guard) and `findOwnEmployee` (`mapEmployeeReadModel`, `null` when missing, no status filter, no `password`).  
> Do not call `updateMainData` or `updatePersonalData`. Do not write `toJSON()`. No schema migration.

## Application ports

### Write — `application/ports/outbound/update-own-employee-data-repository.port.ts`

```ts
export interface UpdateOwnEmployeeDataParams {
  id: string
  name?: string
  phone?: string
  username?: string | null
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | null
  address?: string | null
}

export interface UpdateOwnEmployeeDataRepositoryPort {
  updateOwnData(params: UpdateOwnEmployeeDataParams): Promise<void>
}
```

Presence = key is not `undefined` on `params`. `field: null` is present (clear). Omitted keys are absent from `$set`. The port's `nif` is a **string** (VO `.value`) or `null`. Coercion to `Number` stays inside the repository. There is no `email` field.

### Read — `application/ports/outbound/find-own-employee.port.ts`

```ts
export interface FindOwnEmployeePort {
  findOwnEmployee(id: string): Promise<GetEmployeesItemDto | null>
}
```

`GetEmployeesItemDto` is the list item. Do not introduce a second read-model interface. The result has no `password`.

## Repository

Same `EmployeeMongooseRepository`. It implements both ports. Do not construct a second repository class.

### `updateOwnData`

Copy the `$set`-only filter from `updatePersonalData`, then coerce `nif` when that key survived the filter:

```ts
async updateOwnData(params: UpdateOwnEmployeeDataParams): Promise<void> {
  const { id, ...fields } = params
  const $set: Record<string, string | number | null> =
    this.buildUpdateFilterEntries(fields)
  if ('nif' in $set && $set.nif !== null) {
    $set.nif = Number($set.nif)
  }
  const result = await this.employeeModel.updateOne({ _id: id }, { $set })
  if (result.matchedCount === 0) {
    throw new Error('Employee own data update matched 0 documents')
  }
}
```

Equivalent hand-built `$set` is fine. Do **not** `$unset`. Do **not** `Number(null)` (`Number(null)` is `0`). Do **not** call `updateMainData` or `updatePersonalData`. Do **not** write `email`, `password`, `status`, `role`, `jobTitle`, `employmentId`, `deactivateAt`, or `removedAt`.

| Key on params | Schema | `$set` |
|---------------|--------|--------|
| omitted | — | not in `$set` |
| `name` / `phone` string | String | that string |
| `username: null` | String | `username: null` |
| `username: 'joao'` | String | `username: 'joao'` |
| `gender` / `languages` / `address` / `emergencyContact` string or `null` | String | as given / `null` |
| `nif: '123456789'` | **Number** | `nif: 123456789` (`Number(value)`) |
| `nif: null` | **Number** | `nif: null` |

A `matchedCount === 0` after the use case loaded the Actor is a race or a bad id. **Throw** a non-domain `Error` so slice 4 maps it to `500`. Do **not** throw `EmployeeNotFoundError` or `ActorAuthenticationFailedError`. Do **not** resolve as a silent success.

`modifiedCount === 0` with `matchedCount === 1` (same values) is success — do not throw.

### `findOwnEmployee`

Load one document by `_id` (same `findById` + `lean` shape as `findById`). No document → `null`.

When a document exists, return `mapEmployeeReadModel(document)`. Do **not** return `mapEmployeeDocument` / `EmployeeModel.toCreate`. Do **not** filter by status. `INACTIVE` and `REMOVED` documents are still returned; login-capable is the policy's job in slices 2 and 3. Do **not** use `FindEmployeesPort.findAll` (that query excludes `REMOVED`).

Do not add `password` to the returned object. `mapEmployeeReadModel` already omits it and stringifies a numeric `nif`.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/update-own-employee-data-repository.port.ts` | Create |
| `application/ports/outbound/find-own-employee.port.ts` | Create |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | `updateOwnData` + `findOwnEmployee` |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover `$set`, `nif` coercion, 0-match, read model, miss, no status filter |
| `employee.schema.ts` / `employee.mapper.ts` / controllers / use cases / `app.ts` | Do not change |

## Spec expectations (`employee-mongoose.repository.spec.ts`)

Same `makeSut` / `updateOne` spy harness as `updatePersonalData` for the write. For the read, spy `findById` (or the model method the implementation uses) and return a lean document or `null`.

| `it(...)` | Assert |
|-----------|--------|
| `{ id, phone: '+351 912 345 678' }` `$set` is only `{ phone }` | no `name` / `email` / `username` / `nif` / `password` / `status` |
| `{ id, username: null }` `$set` is `{ username: null }` | not omitted |
| `{ id, username: 'joao' }` `$set` is `{ username: 'joao' }` | |
| `{ id, nif: null }` `$set` is `{ nif: null }` | not `0`, not omitted |
| `{ id, nif: '123456789' }` `$set.nif` is the number `123456789` | `typeof` number, not the string |
| omitted `address` | `$set` has no `address` key |
| all eight keys present | `$set` has those eight only; `nif` is a number when non-null; no `email` |
| `{ id, gender: null, languages: null }` | both keys are `null` |
| `matchedCount === 0` | throws `Error` whose message matches the own-data guard (not `EmployeeNotFoundError`, not `ActorAuthenticationFailedError`) |
| `matchedCount === 1` and `modifiedCount === 0` | resolves |
| `updateOne` filter is `{ _id: id }` | |
| `updateOwnData` does not call `updateMainData` or `updatePersonalData` | if those are spies on the same instance |
| `findOwnEmployee` miss | resolves `null`; query filter is the id only, no `status` |
| `findOwnEmployee` hit | result equals `mapEmployeeReadModel(document)`; `'password' in result` is false; `nif` is a string when the document stored a number |
| document `status: INACTIVE` | still returned (not filtered out) |
| document `status: REMOVED` | still returned |

Do not add a parallel `__tests__` tree. Schema and mapper files are coverage-excluded; do not move logic into them.

## Checklist (agent)

- [ ] Both ports live under `application/ports/outbound/`
- [ ] `$set` contains only keys `!== undefined`
- [ ] `username: null` and personal `null` clears are written; omitted keys are not
- [ ] Non-null `nif` is `Number(value)` inside the repository only
- [ ] `nif: null` is not coerced to `0`
- [ ] No `email` / `password` / `status` / `role` / `jobTitle` / `employmentId` on the write
- [ ] No `toJSON()` / full replace / `$unset`
- [ ] `updateOwnData` does not call `updateMainData` or `updatePersonalData`
- [ ] 0-match throws unexpected (not silent success, not a domain 401/400)
- [ ] Same-value write (`matchedCount === 1`) succeeds
- [ ] `findOwnEmployee` uses `mapEmployeeReadModel` and returns `null` only when there is no document
- [ ] Read does not filter by status and does not include `password`
- [ ] Repository spec updated; existing `updateMainData` / `updatePersonalData` / `findAll` cases still pass
- [ ] No HTTP / use case / query / policy wiring in this slice

## Out of scope

- Login-capable checks (policy)
- Reconstitute / mutators
- Route / controller
- Schema migration
- Changing `findById`, `findAll`, or `mapEmployeeReadModel`
- Stripping `password` from `EmployeeModel.toCreate`

## Acceptance criteria

- [ ] `{ id, phone }` does not rewrite the other own fields, email, password, or status
- [ ] `{ id, username: null }` persists `username: null`
- [ ] `{ id, nif: null }` persists `nif: null`
- [ ] `{ id, nif: '123456789' }` persists `nif` as the number `123456789`
- [ ] Omitted keys leave the stored document untouched
- [ ] 0-document `$set` throws
- [ ] `findOwnEmployee` of a missing id is `null`
- [ ] `findOwnEmployee` of an existing id is a `GetEmployeesItemDto` with no `password`, including when status is `INACTIVE` or `REMOVED`
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| `$set` + `nif` coercion to copy | `updatePersonalData` on `EmployeeMongooseRepository` |
| Read mapper (do not edit) | `mapEmployeeReadModel` in `employee.mapper.ts` |
| Write snapshot to avoid | `findById` → `mapEmployeeDocument` (includes `password`) |
| List filter to avoid | `findAll` / `buildFindFilter` excludes `REMOVED` |
| Next slices | [`02-usecase.md`](./02-usecase.md), [`03-query.md`](./03-query.md) |
