# Spec: Slice 0 — Domain (policy, own patch service, empty error)

> Pure domain of Update Own Employee Data.  
> Parent: [`README.md`](./README.md).  
> Depends on: none. The Main username prerequisite does not block this slice.  
> Design §7.  
> Jira: TBD.  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give the hexagon one login-capable policy and one synchronous patch service that writes name, phone, and username through the existing entity mutators and delegates the five personal fields to `EmployeePersonalDataPatchService`. There is no Target and no role matrix.

| Spec | Responsibility |
|------|----------------|
| **This file** | `EmptyOwnEmployeeDataError`; `EmployeeOwnDataPolicy` + spec; `EmployeeOwnDataPatchService` + spec |
| [`01-persistence.md`](./01-persistence.md) | One `$set` + own read port |
| [`02-usecase.md`](./02-usecase.md) | Use case calls `assertCan`, resolver, then `apply` |
| [`03-query.md`](./03-query.md) | Query calls `assertCan(status)` on the read model |
| [`04-http-and-contract.md`](./04-http-and-contract.md) | HTTP maps the errors |
| `Employee` mutators | **Unchanged** — `patchName` / `patchPhone` / `patchUsername` and the personal `assign*` already exist |
| `EmployeeMainDataPatchService` | **Unchanged** — this command does not call it |
| `EmployeePersonalDataPatchService` | **Reused** — do not edit it |
| Operator policies | **Unchanged** |

## When to use this spec

Use this document to change **domain only** (`domain/` + co-located specs).

| Artifact | This slice? |
|----------|-------------|
| `EmptyOwnEmployeeDataError` | Yes |
| `EmployeeOwnDataPolicy.assertCan(status)` + spec | Yes |
| `EmployeeOwnDataPatchService.apply` + spec | Yes |
| New entity mutators | **No** |
| Mongo `$set` / HTTP / use case / query / resolver | **No** |
| `EmployeeMainDataPolicy` / `EmployeePersonalDataPolicy` / `EmployeeProfessionalDataPolicy` | **No** |
| `Employee.create` | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Update Own Employee Data following [`docs/specs/update-own-employee-data/00-domain.md`](./00-domain.md).  
> Add `EmptyOwnEmployeeDataError`, `EmployeeOwnDataPolicy.assertCan(status)`, and a synchronous `EmployeeOwnDataPatchService` that delegates personal fields and calls `patchName` / `patchPhone` / `patchUsername`.  
> Do not call `EmployeeMainDataPatchService`. Do not add a mutator. Do not throw `EmployeeAlreadyRemovedError`. Do not add Mongo, HTTP, the use case, or the query.

## 1. Domain error

Add to `domain/errors/employee.errors.ts` (same `DomainError` style, fixed message — controllers later map class → HTTP, not message matching):

| Class | Message | Typical HTTP (slice 4) |
|-------|---------|------------------------|
| `EmptyOwnEmployeeDataError` | `At least one own employee data field is required` | `400` |

`EmptyOwnEmployeeDataError` is thrown by the resolver in slice 2. Define the class here; do not add the resolver in this slice.

Reuse `ActorAuthenticationFailedError`, `InvalidNameError`, `InvalidPhoneFormatError`, `InvalidNifError`, and `InvalidEmployeeGenderError`. Do not throw `EmptyMainEmployeeDataError`, `EmptyPersonalEmployeeDataError`, `EmployeeMainDataForbiddenError`, `EmployeePersonalDataForbiddenError`, `EmployeeProfessionalDataForbiddenError`, `EmployeeNotFoundError`, or `EmployeeAlreadyRemovedError` from this policy or this patch service.

## 2. `EmployeeOwnDataPolicy`

Files:

- `domain/services/employee-own-data.policy.ts`
- co-located `employee-own-data.policy.spec.ts`

**Class name:** `EmployeeOwnDataPolicy`. Implementation detail, not a glossary term.

Pure domain. **No** constructor ports. No Express, Mongoose, bcrypt, encrypter, `EmployeePoliciesService`, or any operator policy.

```ts
assertCan(status: EmployeeModel.Status): void
```

`assertCan` is **sync**. Throw on refuse; return on allow. Do not return a boolean.

The method takes a status only. It does not take an `Employee`, a role, an id, or a Target.

| `status` | Result |
|----------|--------|
| `ACTIVE` | return |
| `VACATION` | return |
| `INACTIVE` | `ActorAuthenticationFailedError` |
| `REMOVED` | `ActorAuthenticationFailedError` |
| any other value | `ActorAuthenticationFailedError` |

Missing Actor is not this method's job. The use case and the query throw `ActorAuthenticationFailedError` themselves when the load misses, before calling `assertCan`.

Do not inspect a patch. Do not compare ids. Last Admin does not apply. Step-up password does not apply.

## 3. `EmployeeOwnDataPatchService`

Files:

- `domain/services/employee-own-data-patch.service.ts`
- co-located `employee-own-data-patch.service.spec.ts`

Synchronous. Constructor takes `EmployeePersonalDataPatchService`. No outbound ports. No `EmployeeMainDataPatchService`. No `EmployeePoliciesService`. Do not mark `apply` `async`.

```ts
export type OwnEmployeeDataField =
  | 'name'
  | 'phone'
  | 'username'
  | 'gender'
  | 'languages'
  | 'emergencyContact'
  | 'nif'
  | 'address'

export type OwnEmployeeDataChanges = Partial<
  Record<OwnEmployeeDataField, string | null>
>

export type OwnEmployeeDataPersistPatch = {
  name?: string
  phone?: string
  username?: string | null
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | null
  address?: string | null
}

apply(
  actor: Employee,
  changes: OwnEmployeeDataChanges,
): OwnEmployeeDataPersistPatch
```

`email` is not a key of these types. Do not add it.

Keys in `changes` are the present keys only. Values are `string | null`, never `undefined`. This service does not strip `undefined` and does not throw `EmptyOwnEmployeeDataError` (the resolver does, in slice 2).

Presence inside `apply` is `'field' in changes`. Do not use a truthy `if (changes.name)` or `if (changes.phone)`: that skips `null` and omits the key instead of failing.

| Field | Rule |
|-------|------|
| `name` present | Must be a non-blank string. `actor.patchName(value)` and always include the returned `name` on the persist patch. `null` throws `InvalidNameError`. A string `Name.create` rejects also throws `InvalidNameError` from `patchName`. |
| `phone` present | Must be a non-blank string. `actor.patchPhone(value)` and always include the returned `phone` (VO `.value`). `null` throws `InvalidPhoneFormatError`. An invalid string throws the same error from `patchPhone`. |
| `username` present, including `null` | `actor.patchUsername(value)`. Always include `username` on the persist patch. `null`, `""`, and whitespace become `null` via `Employee.normalizeUsername`. A non-blank value is trimmed. |
| Any personal key present | Build a `PersonalEmployeeDataChanges` with **only** those keys. `personalPatchService.apply(actor, personalChanges)`. Merge the returned patch onto the own persist patch. |

Personal rules stay inside `EmployeePersonalDataPatchService` (gender enum, clear-to-null, `Phone.create`, `Nif.create`). Do not reimplement them here. Do not `Number()` the NIF. The persist patch keeps `nif` as a string or `null`.

Any throw aborts `apply`. Do not catch. The caller has no patch to persist. In-memory mutations inside a failed `apply` are discarded with the entity; persistence sees a patch only when `apply` returns.

An empty `changes` object returns `{}` and writes nothing on the entity. The use case does not call `apply` with an empty object; the resolver throws first.

## Files

| File | Action |
|------|--------|
| `domain/errors/employee.errors.ts` | `EmptyOwnEmployeeDataError` |
| `domain/services/employee-own-data.policy.ts` + `*.spec.ts` | Create |
| `domain/services/employee-own-data-patch.service.ts` + `*.spec.ts` | Create |
| `Employee.ts` / operator policies / `EmployeePersonalDataPatchService` / schema / HTTP / module | Do not change |

## Spec expectations

### `employee-own-data.policy.spec.ts`

`makeSut` → `new EmployeeOwnDataPolicy()` (no stubs, no ports). Pass `EmployeeModel.Status` values. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP / entity.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EmployeeOwnDataPolicy` |
| `ACTIVE` | returns |
| `VACATION` | returns |
| `INACTIVE` | `ActorAuthenticationFailedError` |
| `REMOVED` | `ActorAuthenticationFailedError` |
| signature is status only | call `assertCan(status)`; the spec does not build an Actor, a Target, or a role |

Assert the auth class with `toBeInstanceOf(ActorAuthenticationFailedError)`. Run the existing operator policy specs — they must still pass unchanged.

### `employee-own-data-patch.service.spec.ts`

`makeSut` injects a real `EmployeePersonalDataPatchService` (no ports). Actor via `Employee.create` or `reconstitute` with name, phone, username, and personal fields populated so a one-field patch can prove the others stayed. `apply` is called **without** `await` of a Promise — the return value is the patch object.

| `it(...)` | Assert |
|-----------|--------|
| `{ name: 'Ana Silva' }` | patch `{ name }` is `Name.create('Ana Silva').value`; entity name updated |
| `{ name: null }` | `InvalidNameError`; no returned patch |
| `{ name: 'A' }` | `InvalidNameError` (below min length); no returned patch |
| `{ phone: '+351 912 345 678' }` | patch phone is `Phone.create(...).value` |
| `{ phone: null }` | `InvalidPhoneFormatError`; no returned patch |
| `{ phone: '123' }` | `InvalidPhoneFormatError`; no returned patch |
| `{ username: null }` | patch `{ username: null }` |
| `{ username: '' }` / `{ username: '   ' }` | patch `{ username: null }` |
| `{ username: '  joao  ' }` | patch `{ username: 'joao' }` |
| `{ gender: 'male' }` | patch `{ gender: 'male' }` via the personal service |
| `{ gender: null }` | patch `{ gender: null }` |
| `{ gender: 'invalid' }` / `{ gender: '' }` | `InvalidEmployeeGenderError`; no returned patch |
| `{ languages: 'Português' }` / `{ languages: null }` | set / clear |
| `{ address: 'Rua X' }` / `{ address: null }` | set / clear |
| `{ emergencyContact: '+351 912 345 678' }` | patch value is the normalized phone, not necessarily the raw input |
| `{ emergencyContact: null }` | patch `{ emergencyContact: null }` |
| `{ emergencyContact: '123' }` | `InvalidPhoneFormatError`; no returned patch |
| `{ nif: '123456789' }` | patch `{ nif: '123456789' }` (string) |
| `{ nif: null }` | patch `{ nif: null }` |
| `{ nif: '00000000' }` | `InvalidNifError`; no returned patch |
| `{ name: 'Ana Silva', nif: '00000000' }` | `InvalidNifError`; `apply` does not return a patch the caller could persist |
| one field present | returned patch has only that key |
| name + one personal key | returned patch has those two keys only |
| `{}` | returns `{}`; entity fields unchanged |
| changes object has no `email` key in the type | a name-only patch does not include `email` |

Do not stub `EmployeeMainDataPatchService`. Do not assert occupancy.

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] `assertCan` takes `status` only and is sync
- [ ] `ACTIVE` and `VACATION` pass; `INACTIVE` and `REMOVED` throw `ActorAuthenticationFailedError`
- [ ] Policy does not throw `EmployeeAlreadyRemovedError` or any `*ForbiddenError`
- [ ] `apply` is sync; constructor takes only `EmployeePersonalDataPatchService`
- [ ] `name` / `phone` use `'key' in changes`, not a truthy check; `null` throws
- [ ] `username: null` is on the persist patch
- [ ] Personal keys are delegated; invalid `nif` throws and returns no patch
- [ ] No `email` key on the own types
- [ ] No new entity mutator
- [ ] `EmptyOwnEmployeeDataError` is a new class; resolver is not added here
- [ ] Co-located specs cover the tables
- [ ] Operator policy specs still pass
- [ ] No schema / HTTP / use case / query edits

## Out of scope

- `resolveOwnEmployeeDataChanges` (slice 2 throws `EmptyOwnEmployeeDataError`)
- `updateOwnData` / `findOwnEmployee`
- Controller blank-normalization
- `EmployeeSnapshotMapper`
- Fixing `UpdateMainEmployeeDataController` (prerequisite P, existing Main HTTP spec)

## Acceptance criteria

- [ ] `assertCan(ACTIVE)` and `assertCan(VACATION)` return
- [ ] `assertCan(INACTIVE)` and `assertCan(REMOVED)` throw `ActorAuthenticationFailedError`
- [ ] Policy has no role and no Target parameter
- [ ] `{ name: 'Ana Silva' }` persists a normalized name on the returned patch
- [ ] `{ name: null }` and `{ phone: null }` throw; they do not omit the key
- [ ] `{ username: null }` and `{ username: '' }` return `{ username: null }`
- [ ] `{ gender: 'male' }` is applied through `EmployeePersonalDataPatchService`
- [ ] `{ nif: '00000000' }` throws `InvalidNifError` and does not return a patch
- [ ] `{ name: 'Ana Silva', nif: '00000000' }` throws; the caller has nothing to persist
- [ ] No `email` on the persist patch
- [ ] No new mutator. Operator policies unchanged

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/employees/CONTEXT.md` |
| Status enum | `domain/models/employee.model.ts` |
| Mutators to call (do not edit) | `Employee.patchName`, `patchPhone`, `patchUsername` |
| Personal service to delegate to (do not edit) | `domain/services/employee-personal-data-patch.service.ts` |
| Main patch service (do not call; truthy `if (changes.name)` is the pattern to avoid) | `domain/services/employee-main-data-patch.service.ts` |
| Error style | `EmptyPersonalEmployeeDataError` in `domain/errors/employee.errors.ts` |
| Next slice | [`01-persistence.md`](./01-persistence.md) |
