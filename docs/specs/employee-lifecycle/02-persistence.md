# Spec: Slice 2 — Persistence (`removedAt`, count, anonymize, list exclusion)

> Mongo adapter for terminal Removed.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`01-domain.md`](./01-domain.md) (`REMOVED` exists on the model).  
> Design §10 / [ADR 0004](../../adr/remove-or-inactivate-emp/0004-removed-absent-from-list.md) / [ADR 0013](../../adr/remove-or-inactivate-emp/0013-removed-is-a-status-enum-value.md).  
> Next: [`03-update-employee-status.md`](./03-update-employee-status.md).

## Responsibility (this spec only)

Persist `REMOVED` + `removedAt`, count non-removed ADMINs, `$set` anonymized fields, and keep `REMOVED` off `findAll`.

| Spec | Responsibility |
|------|----------------|
| [`01-domain.md`](./01-domain.md) | Enum, `anonymize()`, `CountNonRemovedAdminsPort` interface |
| **This file** | Schema, mapper, repository methods + spec |
| [`04-remove-employee.md`](./04-remove-employee.md) | Application port `AnonymizeEmployeeRepositoryPort` + use case that calls `anonymize` |
| [`05-list-and-module-contract.md`](./05-list-and-module-contract.md) | HTTP `?status=REMOVED` → `400` (repo already excludes) |

## When to use this spec

Use this document to extend **outbound persistence only**. The Remove use case does not exist yet — still add the repository method so slice 4 can bind the port to the same class.

| Artifact | This slice? |
|----------|-------------|
| Schema `status` enum + `removedAt` | Yes |
| Mapper `removedAt` on write snapshot + create document | Yes |
| `countNonRemovedAdmins` | Yes (implements domain port) |
| `anonymize` `$set` | Yes |
| `findAll` always excludes `REMOVED` | Yes |
| `findById` / `findByEmail` | Unchanged (must still load `REMOVED` / sentinels) |
| Read model (`GetEmployeesItemDto`) | **No** `removedAt` — list never returns Removed |
| HTTP / use cases / module factory signature | **No** |
| `EmployeePoliciesService` | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of employee lifecycle following [`docs/specs/employee-lifecycle/02-persistence.md`](./02-persistence.md).  
> Add `removedAt` and `REMOVED` on the schema; map it on write snapshots; implement `countNonRemovedAdmins`, `anonymize`, and `findAll` exclusion of `REMOVED`.  
> Do not add HTTP Remove or change controllers.

## Schema

File: `employee.schema.ts`.

- `status` enum: `['ACTIVE', 'INACTIVE', 'VACATION', 'REMOVED']` (default still `ACTIVE`).
- `removedAt: { type: Date, default: null }`.

No new unique index. Unique `email` remains — sentinels `removed.{id}@anonymized.invalid` are unique per id.

## Mapper

`mapEmployeeDocument` (write/lookup snapshot):

- `removedAt: document.removedAt ?? null`

`mapToCreateDocument`:

- persist `removedAt` from the snapshot (`null` on create)

`mapEmployeeReadModel`:

- **omit** `removedAt` (list DTO unchanged)

Existing fixtures in repository specs that build lean documents: add `removedAt: null` where TypeScript requires it.

## Repository

Same `EmployeeMongooseRepository`. Implement:

### `countNonRemovedAdmins` — `CountNonRemovedAdminsPort`

```ts
countDocuments({ role: EmployeeModel.Role.ADMIN, status: { $ne: EmployeeModel.Status.REMOVED } })
```

Return the number. Do not filter on `ACTIVE` only — legacy `INACTIVE` / `VACATION` ADMINs still count.

### `anonymize`

Slice 4 will declare `AnonymizeEmployeeRepositoryPort`. In this slice, add the **method** on the repository with this payload (inline type is fine until the application port exists; prefer creating the application port file here if it unblocks typing — either is OK as long as slice 4 does not duplicate it):

```ts
anonymize(params: {
  id: string
  name: string
  email: string
  phone: null
  nif: null
  password: string
  status: typeof EmployeeModel.Status.REMOVED
  removedAt: Date
}): Promise<void>
```

```ts
updateOne(
  { _id: params.id },
  {
    $set: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      nif: params.nif,
      password: params.password,
      status: params.status,
      removedAt: params.removedAt,
    },
  },
)
```

`$set` of those fields **only**. Do not write `role`, `deactivateAt`, `createdAt`, or a full `toJSON()` document (`Password.toJSON()` is `'[REDACTED]'`).

### `findAll` — always exclude `REMOVED`

`buildFindFilter` must always constrain status so sentinels never appear on the collaborators list.

Normative filter:

- No `params.status` → `status: { $ne: REMOVED }`
- Operational `params.status` present → `status: { $eq: params.status, $ne: REMOVED }` (AND). Equality alone is not enough if a buggy caller passed `REMOVED`.

`countDocuments` uses the **same** filter (`total` / `totalPages` stay on the filtered set, including the exclusion).

Role / search clauses stay as today, composed with that status constraint.

Update existing `findAll` assertions that expected `{}` or `{ status: ACTIVE, ... }` to include the `$ne: REMOVED` constraint.

### `findById` / `findByEmail`

Unchanged on purpose. Remove and policy need to load a `REMOVED` row or a sentinel email if hit. Do **not** add `$ne: REMOVED` there.

## Module / create path

`create` already goes through `mapToCreateDocument`. New employees persist `removedAt: null` once the mapper forwards it. No change to `CreateEmployeeUsecase`.

Do not wire `EmployeeLifecyclePolicy` in this slice.

## Files

| File | Action |
|------|--------|
| `infrastructure/outbound/persistence/employee.schema.ts` | Enum + `removedAt` |
| `infrastructure/outbound/persistence/employee.mapper.ts` | `removedAt` on write/create maps |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | `countNonRemovedAdmins`, `anonymize`, `buildFindFilter` |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover the three behaviors; update `findAll` filters |
| `application/ports/outbound/anonymize-employee-repository.port.ts` | Create if you bind the repo to the port now; else slice 4 |
| Controllers / use cases / `app.ts` / `.http` | Do not change |

## Spec expectations (`employee-mongoose.repository.spec.ts`)

Same `makeChainableMock` harness as today.

| `it(...)` | Assert |
|-----------|--------|
| `countNonRemovedAdmins` calls `countDocuments` with `{ role: ADMIN, status: { $ne: REMOVED } }` | query exact |
| `countNonRemovedAdmins` returns the numeric result | e.g. `2` |
| `anonymize` `updateOne` `$set` only the anonymized fields | no `role` / `deactivateAt` in `$set` |
| `findAll` without status uses `{ status: { $ne: REMOVED } }` | `find` and `countDocuments` |
| `findAll` with `status: ACTIVE` ANDs `$eq: ACTIVE` and `$ne: REMOVED` | same filter on find + count |
| `findAll` with `status: INACTIVE` still ANDs `$ne: REMOVED` | does not drop exclusion |
| `findById` / `findByEmail` queries unchanged (no `$ne: REMOVED`) | existing cases still valid; add `removedAt: null` on lean fixtures if needed |

Do not add a parallel `__tests__` tree. Schema files are coverage-excluded; do not move logic into the schema.

## Checklist (agent)

- [ ] Schema enum includes `REMOVED`; `removedAt` default `null`
- [ ] Write mapper round-trips `removedAt`
- [ ] Read model still has no password and no `removedAt`
- [ ] `countNonRemovedAdmins` counts ADMIN with `status ≠ REMOVED`
- [ ] `anonymize` is partial `$set` only
- [ ] `findAll` / `countDocuments` never return `REMOVED`
- [ ] `findById` / `findByEmail` can still load `REMOVED`
- [ ] Repository spec updated; existing create/findById cases still pass
- [ ] No HTTP / policy wiring in this slice

## Out of scope

- `GET /api/employees?status=REMOVED` → `400` (controller, slice 5)
- Generating sentinel values (entity, already slice 1)
- Encrypting the random password (slice 4)
- Unique-index migration of existing rows

## Acceptance criteria

- [ ] A document with `status: REMOVED` is omitted from `findAll` (no status filter and with an operational status filter)
- [ ] `countNonRemovedAdmins` does not count `REMOVED` ADMINs and does count `INACTIVE` ADMINs
- [ ] `anonymize` updates PII/status/password/`removedAt` without touching `role` or `deactivateAt`
- [ ] `findByEmail` on the original address after anonymize is a miss (once slice 4 writes sentinels); `findByEmail` on the sentinel still hits
- [ ] Repository spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Schema / mapper / repo today | `infrastructure/outbound/persistence/` |
| Why keep the id | [ADR 0001](../../adr/remove-or-inactivate-emp/0001-employee-remove-is-anonymization.md) |
| Why hide from list | [ADR 0004](../../adr/remove-or-inactivate-emp/0004-removed-absent-from-list.md) |
| Domain port to implement | `domain/ports/count-non-removed-admins.port.ts` |
| Next slice | [`03-update-employee-status.md`](./03-update-employee-status.md) |
