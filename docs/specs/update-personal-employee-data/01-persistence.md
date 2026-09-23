# Spec: Slice 1 — Persistence (`updatePersonalData` `$set` esparso)

> Mongo adapter for a sparse Personal Data write.  
> Parent: [`README.md`](./README.md).  
> Depends on: none of the domain slice (the port is typed without the entity). Prefer landing after or with the port file only.  
> Design §10.  
> Jira: TBD.  
> Next: [`02-usecase.md`](./02-usecase.md).

## Responsibility (this spec only)

Persist only the Personal Data keys **present** on the command. `nif` on the wire of this port is `string | null`; the schema type is `Number`, so this method coerces on write. Create still inserts a full document. `updateMainData` already `$set`s only what it owns — copy that rule.

| Spec | Responsibility |
|------|----------------|
| [`00-domain.md`](./00-domain.md) | Entity / policy / patch service (unused here) |
| **This file** | Application outbound port + repository method + spec |
| [`02-usecase.md`](./02-usecase.md) | Use case builds the present-key payload (`nif` still a string) |
| Schema / mapper / read model | **Unchanged** |

## When to use this spec

Use this document to extend **outbound persistence only**. The use case does not exist yet — still add the repository method so slice 2 can bind the port to the same class.

| Artifact | This slice? |
|----------|-------------|
| `UpdatePersonalEmployeeDataRepositoryPort` | Yes |
| `EmployeeMongooseRepository.updatePersonalData` | Yes |
| Schema / indexes | **No** — personal fields already exist |
| Mapper / `toCreate` / list read model | **No** — `mapToCreateDocument` already does `Number(nif)` on insert; do not move that helper |
| Use case / HTTP / module factory | **No** |
| `toJSON()` as a write | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Update Personal Employee Data following [`docs/specs/update-personal-employee-data/01-persistence.md`](./01-persistence.md).  
> Add `UpdatePersonalEmployeeDataRepositoryPort` and `updatePersonalData` on `EmployeeMongooseRepository`. `$set` only present keys. `nif` must be `Number(value)` in `$set` when non-null — schema type is Number. `nif: null` persists `null`.  
> No schema migration. Do not write `toJSON()`. Do not add the use case.

## Application port

File: `application/ports/outbound/update-personal-employee-data-repository.port.ts`.

```ts
export interface UpdatePersonalEmployeeDataParams {
  id: string
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | null
  address?: string | null
}

export interface UpdatePersonalEmployeeDataRepositoryPort {
  updatePersonalData(params: UpdatePersonalEmployeeDataParams): Promise<void>
}
```

Presence = key is not `undefined` on `params`. `field: null` is present (clear). Omitted keys are absent from `$set`. The port's `nif` is a **string** (VO `.value`) or `null`. Coercion to `Number` stays inside the repository.

## Repository

Same `EmployeeMongooseRepository`. Implement the same `$set`-only filter as `updateMainData`, then coerce `nif` when that key survived the filter:

```ts
async updatePersonalData(
  params: UpdatePersonalEmployeeDataParams,
): Promise<void> {
  const { id, ...fields } = params
  const $set: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  )
  if ('nif' in $set && $set.nif !== null) {
    $set.nif = Number($set.nif)
  }
  const result = await this.employeeModel.updateOne({ _id: id }, { $set })
  if (result.matchedCount === 0) {
    throw new Error('Employee personal data update matched 0 documents')
  }
}
```

Equivalent hand-built `$set` is fine. Do **not** `$unset`. Do **not** `Number(null)` (`Number(null)` is `0`). Do **not** write `name`, `email`, `phone`, `username`, `password`, `status`, `role`, `deactivateAt`, `removedAt`, or professional fields.

| Key on params | Schema | `$set` |
|---------------|--------|--------|
| omitted | — | not in `$set` |
| `gender: 'male'` | String | `gender: 'male'` |
| `gender: null` | String | `gender: null` |
| `languages: 'Português'` / `languages: null` | String | as given / `null` |
| `address: 'Rua X'` / `address: null` | String | as given / `null` |
| `emergencyContact: '351912345678'` / `null` | String | as given / `null` |
| `nif: '123456789'` | **Number** | `nif: 123456789` (`Number(value)`) |
| `nif: null` | **Number** | `nif: null` |

### 0-document write

Same guard as `updateMainData`. A `matchedCount === 0` after the use case loaded the Target is a race or a bad id. **Throw** a non-domain `Error` so slice 3 maps it to `500`. Do **not** throw `EmployeeNotFoundError` (that is `400` for a Target miss on load). Do **not** resolve as a silent success.

`modifiedCount === 0` with `matchedCount === 1` (same values) is success — do not throw.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/update-personal-employee-data-repository.port.ts` | Create |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | `updatePersonalData` |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover `$set` presence, `nif` coercion, 0-match |
| `employee.schema.ts` / mapper / controllers / use cases / `app.ts` | Do not change |

## Spec expectations (`employee-mongoose.repository.spec.ts`)

Same `makeSut` / `updateOne` spy harness as `updateMainData`.

| `it(...)` | Assert |
|-----------|--------|
| `{ id, gender: 'male' }` `$set` is only `{ gender: 'male' }` | no `languages` / `nif` / `address` / `name` / `password` / `status` |
| `{ id, nif: null }` `$set` is `{ nif: null }` | not `0`, not omitted |
| `{ id, nif: '123456789' }` `$set.nif` is the number `123456789` | `typeof` number, not the string |
| omitted `gender` | `$set` has no `gender` key |
| all five keys present | `$set` has those five only; `nif` is a number when non-null |
| `{ id, languages: null, address: null }` | both keys are `null` |
| `matchedCount === 0` | throws (not `EmployeeNotFoundError`) |
| `matchedCount === 1` and `modifiedCount === 0` | resolves |
| `updateOne` filter is `{ _id: id }` | same as `updateMainData` |

Do not add a parallel `__tests__` tree. Schema files are coverage-excluded; do not move logic into the schema.

## Checklist (agent)

- [ ] Port lives under `application/ports/outbound/`
- [ ] `$set` contains only keys `!== undefined`
- [ ] `null` clears are written; omitted keys are not
- [ ] Non-null `nif` is `Number(value)` inside the repository only
- [ ] `nif: null` is not coerced to `0`
- [ ] No `toJSON()` / full replace
- [ ] 0-match throws unexpected (not silent success, not `EmployeeNotFoundError`)
- [ ] Same-value write (`matchedCount === 1`) succeeds
- [ ] Repository spec updated; existing `updateMainData` / `updateStatus` / `anonymize` cases still pass
- [ ] No HTTP / use case / policy wiring in this slice

## Out of scope

- Gender enum checks (already domain)
- Reconstitute / mutators
- Route / controller
- Schema migration for `languages`
- Changing `findById` / `mapEmployeeDocument` / `mapToCreateDocument`

## Acceptance criteria

- [ ] `{ id, gender: 'male' }` does not rewrite the other personal fields, Main Data, password, or status
- [ ] `{ id, nif: null }` persists `nif: null`
- [ ] `{ id, nif: '123456789' }` persists `nif` as the number `123456789`
- [ ] Omitted keys leave the stored document untouched
- [ ] No `toJSON()` / full replace
- [ ] 0-document `$set` throws
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| `$set`-only sibling | `updateMainData` on `EmployeeMongooseRepository` |
| Insert coercion to copy | `mapToCreateDocument` (`nif ? Number(nif) : null`) |
| Schema today (do not change) | `infrastructure/outbound/persistence/employee.schema.ts` (`nif: { type: Number }`) |
| Next slice | [`02-usecase.md`](./02-usecase.md) |
