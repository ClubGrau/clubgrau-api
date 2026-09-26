# Spec: Slice 1 — Persistence (`countLoginCapableAdmins` + `updateProfessionalData`)

> Mongo adapter for the login-capable ADMIN count and a sparse professional / status write.  
> Parent: [`README.md`](./README.md).  
> Depends on: the count **interface** from [`00-domain.md`](./00-domain.md). The write port is typed without the entity. Prefer landing after or with those port files.  
> Design §10. [ADR 0002](../../adr/update-professional-employee-data/0002-login-capable-admin-count-is-its-own-port.md).  
> Jira: TBD.  
> Next: [`02-usecase.md`](./02-usecase.md).

## Responsibility (this spec only)

1. Implement `countLoginCapableAdmins` on the same repository (`ACTIVE | VACATION` ADMINs). Do **not** change `countActiveAdmins`.
2. Persist only the professional / status keys **present** on the command, in **one** `$set`. Create still inserts a full document. `updateMainData` / `updatePersonalData` already `$set` only what they own — copy that rule. This command does **not** call `updateStatus`.

| Spec | Responsibility |
|------|----------------|
| [`00-domain.md`](./00-domain.md) | `CountLoginCapableAdminsPort` interface; entity / policy / patch service (unused here) |
| **This file** | Count query + application outbound write port + repository methods + spec |
| [`02-usecase.md`](./02-usecase.md) | Use case builds the present-key payload |
| Schema / mapper / read model | **Unchanged** — `jobTitle`, `role`, `status`, `deactivateAt` already exist |

## When to use this spec

Use this document to extend **outbound persistence only**. The use case does not exist yet — still add the repository methods so slice 2 can bind the ports to the same class.

| Artifact | This slice? |
|----------|-------------|
| `EmployeeMongooseRepository.countLoginCapableAdmins` | Yes — implements `CountLoginCapableAdminsPort` |
| `UpdateProfessionalEmployeeDataRepositoryPort` | Yes |
| `EmployeeMongooseRepository.updateProfessionalData` | Yes |
| Schema / indexes | **No** |
| Mapper / `toCreate` / list read model | **No** — List already returns `jobTitle`, `role`, `status`, `employmentId` |
| `countActiveAdmins` / `updateStatus` | **No** — do not change or call |
| Use case / HTTP / module factory | **No** |
| `toJSON()` as a write | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Update Professional Employee Data following [`docs/specs/update-professional-employee-data/01-persistence.md`](./01-persistence.md).  
> Add `countLoginCapableAdmins` on `EmployeeMongooseRepository` (`role: ADMIN`, `status ∈ { ACTIVE, VACATION }`). Add `UpdateProfessionalEmployeeDataRepositoryPort` and `updateProfessionalData`. `$set` only present keys. `jobTitle: null` persists.  
> Do not change `countActiveAdmins`. Do not call or widen `updateStatus`. No schema migration. Do not write `toJSON()`. Do not add the use case.

## Count query

Same `EmployeeMongooseRepository`. Add `CountLoginCapableAdminsPort` to the class `implements` list (it already implements `CountActiveAdminsPort` and `CountNonRemovedAdminsPort`).

```ts
countLoginCapableAdmins(): Promise<number> {
  return this.employeeModel.countDocuments({
    role: EmployeeModel.Role.ADMIN,
    status: {
      $in: [EmployeeModel.Status.ACTIVE, EmployeeModel.Status.VACATION],
    },
  })
}
```

Return the number. Include `VACATION`. Do **not** include `INACTIVE` or `REMOVED`. Do **not** edit `countActiveAdmins` (ACTIVE-only) or `countNonRemovedAdmins`.

## Application write port

File: `application/ports/outbound/update-professional-employee-data-repository.port.ts`.

```ts
export interface UpdateProfessionalEmployeeDataParams {
  id: string
  jobTitle?: string | null
  role?: EmployeeModel.Role
  status?: EmployeeModel.Status
  deactivateAt?: Date | null
}

export interface UpdateProfessionalEmployeeDataRepositoryPort {
  updateProfessionalData(
    params: UpdateProfessionalEmployeeDataParams,
  ): Promise<void>
}
```

Presence = key is not `undefined` on `params`. `jobTitle: null` is present (clear). `deactivateAt: null` is present (Reactivate / Vacation clear the date). Omitted keys are absent from `$set`.

The port may receive `status` / `deactivateAt` because Status may travel on this save ([ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md)). The use case (slice 2) only passes those keys on a Status **delta**. This method does not decide that.

## Repository write

Same `EmployeeMongooseRepository`. Implement the same `$set`-only filter as `updateMainData`:

```ts
async updateProfessionalData(
  params: UpdateProfessionalEmployeeDataParams,
): Promise<void> {
  const { id, ...fields } = params
  const $set = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  )
  const result = await this.employeeModel.updateOne({ _id: id }, { $set })
  if (result.matchedCount === 0) {
    throw new Error('Employee professional data update matched 0 documents')
  }
}
```

Equivalent hand-built `$set` is fine. Do **not** `$unset`. Do **not** write `employmentId`, password, Main Data, Personal Data, `removedAt`, or `username`. Do **not** call `updateStatus` from this method. Do **not** persist `employee.toJSON()`.

| Key on params | `$set` |
|---------------|--------|
| omitted | not in `$set` |
| `jobTitle: 'Barbeiro'` | `jobTitle: 'Barbeiro'` |
| `jobTitle: null` | `jobTitle: null` |
| `role: 'MANAGER'` | `role: 'MANAGER'` |
| `status` + `deactivateAt` | both, only when the caller passed them |
| `deactivateAt: null` | `deactivateAt: null` |

### 0-document write

Same guard as `updateMainData` / `updatePersonalData`. A `matchedCount === 0` after the use case loaded the Target is a race or a bad id. **Throw** a non-domain `Error` so slice 3 maps it to `500`. Do **not** throw `EmployeeNotFoundError` (that is `400` for a Target miss on load). Do **not** resolve as a silent success.

`modifiedCount === 0` with `matchedCount === 1` (same values) is success — do not throw.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/update-professional-employee-data-repository.port.ts` | Create |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | `countLoginCapableAdmins` + `updateProfessionalData` + `implements CountLoginCapableAdminsPort` |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover count filter + `$set` presence + 0-match |
| `employee.schema.ts` / mapper / `countActiveAdmins` / `updateStatus` / controllers / use cases / `app.ts` | Do not change |

## Spec expectations (`employee-mongoose.repository.spec.ts`)

Same `makeSut` / `updateOne` / `countDocuments` spy harness as `countActiveAdmins` / `updateMainData`.

### `countLoginCapableAdmins`

| `it(...)` | Assert |
|-----------|--------|
| filter is `role: ADMIN` and `status: { $in: [ACTIVE, VACATION] }` | not `ACTIVE` only; not `$ne: REMOVED` |
| returns the numeric result | e.g. `2` |
| existing `countActiveAdmins` filter | still `{ role: ADMIN, status: ACTIVE }` — add a regression if you touch that describe, otherwise leave it |

### `updateProfessionalData`

| `it(...)` | Assert |
|-----------|--------|
| `{ id, jobTitle: 'Barbeiro' }` `$set` is only `{ jobTitle: 'Barbeiro' }` | no `role` / `status` / `deactivateAt` / `name` / `password` / `employmentId` |
| `{ id, jobTitle: null }` `$set` is `{ jobTitle: null }` | present-and-null is not omitted |
| omitted `jobTitle` | `$set` has no `jobTitle` key |
| `{ id, role: MANAGER }` `$set` is only `{ role }` | no `jobTitle` / `status` |
| `{ id, status, deactivateAt }` | `$set` has those two only |
| `{ id, jobTitle, role, status, deactivateAt }` | those four only |
| `{ id, status: ACTIVE, deactivateAt: null }` | both keys present; `deactivateAt` is `null` |
| `matchedCount === 0` | throws (not `EmployeeNotFoundError`) |
| `matchedCount === 1` and `modifiedCount === 0` | resolves |
| `updateOne` filter is `{ _id: id }` | same as `updateMainData` |

Do not add a parallel `__tests__` tree. Schema files are coverage-excluded; do not move logic into the schema.

## Checklist (agent)

- [ ] Write port lives under `application/ports/outbound/`
- [ ] `countLoginCapableAdmins` uses `ACTIVE \| VACATION`; `countActiveAdmins` unchanged
- [ ] `$set` contains only keys `!== undefined`
- [ ] `jobTitle: null` is written; omitted keys are not
- [ ] `status` / `deactivateAt` are written only when present on params
- [ ] No `toJSON()` / full replace / `$unset` / `employmentId`
- [ ] Does not call `updateStatus`
- [ ] 0-match throws unexpected (not silent success, not `EmployeeNotFoundError`)
- [ ] Same-value write (`matchedCount === 1`) succeeds
- [ ] Repository spec updated; existing `updateMainData` / `updatePersonalData` / `updateStatus` / `countActiveAdmins` cases still pass
- [ ] No HTTP / use case / policy wiring in this slice

## Out of scope

- Role / Job Title validation (already domain)
- Reconstitute / mutators / snapshot mapper
- Route / controller
- Schema migration
- Changing `findById` / `mapEmployeeDocument` / `mapToCreateDocument`
- Widening `updateStatus` to accept `jobTitle`

## Acceptance criteria

- [ ] `countLoginCapableAdmins` counts `ADMIN` + `ACTIVE` and `ADMIN` + `VACATION` only
- [ ] `countActiveAdmins` still counts `ADMIN` + `ACTIVE` only
- [ ] `{ id, jobTitle: 'Barbeiro' }` does not rewrite role, status, password, Main Data, Personal Data, or `employmentId`
- [ ] `{ id, jobTitle: null }` persists `jobTitle: null`
- [ ] Omitted keys leave the stored document untouched
- [ ] `{ id, status, deactivateAt }` persists both in one `$set`
- [ ] No `toJSON()` / full replace
- [ ] 0-document `$set` throws
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| `$set`-only siblings | `updateMainData` / `updatePersonalData` on `EmployeeMongooseRepository` |
| Count siblings (do not edit) | `countActiveAdmins` / `countNonRemovedAdmins` |
| Domain port from slice 0 | `domain/ports/count-login-capable-admins.port.ts` |
| Schema today (do not change) | `infrastructure/outbound/persistence/employee.schema.ts` |
| Why a new count | [ADR 0002](../../adr/update-professional-employee-data/0002-login-capable-admin-count-is-its-own-port.md) |
| Next slice | [`02-usecase.md`](./02-usecase.md) |
