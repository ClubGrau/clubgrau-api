# Spec: Slice 0 — Domain (`Gender`, mutators, policy, patch service)

> Pure domain of Update Personal Employee Data.  
> Parent: [`README.md`](./README.md).  
> Depends on: none.  
> Design §7.  
> Jira: TBD.  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give the hexagon a `Gender` enum, personal-field mutators, and one `EmployeePersonalDataPolicy` plus one pure `EmployeePersonalDataPatchService`. The matrix, login-capable Actor, and Target-not-Removed live on the new policy — not on `EmployeeMainDataPolicy` or `EmployeeLifecyclePolicy`.

| Spec | Responsibility |
|------|----------------|
| **This file** | Enum, entity mutators, three errors, policy + patch service + specs |
| [`01-persistence.md`](./01-persistence.md) | `$set` of present Personal Data keys |
| [`02-usecase.md`](./02-usecase.md) | Use case calls `assertCan`, resolver, then `apply` |
| [`03-http-and-contract.md`](./03-http-and-contract.md) | HTTP maps the new errors |
| `EmployeeMainDataPolicy` | **Unchanged** |
| `EmployeeLifecyclePolicy` | **Unchanged** |
| `assignNif` | **Unchanged** — the patch service calls it |

## When to use this spec

Use this document to change **domain only** (`domain/` + co-located specs).

| Artifact | This slice? |
|----------|-------------|
| `EmployeeModel.Gender` + `isGender` | Yes |
| `assignGender` / `assignLanguages` / `assignAddress` / `assignEmergencyContact` | Yes |
| `EmployeePersonalDataForbiddenError`, `EmptyPersonalEmployeeDataError`, `InvalidEmployeeGenderError` | Yes |
| `EmployeePersonalDataPolicy.assertCan` + spec | Yes |
| `EmployeePersonalDataPatchService.apply` + spec | Yes |
| Mongo `$set` / HTTP / use case / resolver | **No** |
| Intent enum on any policy | **No** |
| Gender validation inside `Employee.create` | **No** |
| `patch*` helpers on `Employee` for personal fields | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Update Personal Employee Data following [`docs/specs/update-personal-employee-data/00-domain.md`](./00-domain.md).  
> Add `EmployeeModel.Gender`, the four `assign*` mutators, the three personal-data errors, `EmployeePersonalDataPolicy.assertCan`, and a synchronous `EmployeePersonalDataPatchService.apply`.  
> Do not touch `EmployeeMainDataPolicy`. Do not add an intent enum. Do not add Mongo, HTTP, or the use case.

## 1. `EmployeeModel.Gender`

File: `domain/models/employee.model.ts`, next to `Role` and `Status`.

Values are **lowercase**. Do not copy the uppercase style of `Role` / `Status`.

```ts
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export const GENDERS: readonly Gender[] = Object.freeze(Object.values(Gender));

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as string[]).includes(value);
}
```

`null` is not a `Gender`. It is the cleared state, handled by the patch service.

## 2. `Employee` — new mutators

File: `domain/entities/Employee.ts`. Follow `assignNif`. Add:

```ts
assignGender(gender: EmployeeModel.Gender | null): void
assignLanguages(languages: string | null): void
assignAddress(address: string | null): void
assignEmergencyContact(contact: Phone | null): void
```

Rules:

- Assign the argument onto the existing prop. `null` clears.
- Do not trim. Do not validate the gender enum here — `assignGender` already receives `Gender | null`.
- Do not add `patchGender` / `patchLanguages` / `patchAddress` / `patchEmergencyContact`. The patch service creates VOs, then calls `assign*`.
- `assignNif` stays as it is.
- Leave `EmployeeProps.gender` as `string | null`. `Gender` is a string enum, so it assigns. Do not retype Create's input and do not validate gender inside `Employee.create` in this slice.
- `emergencyContact` on the entity stays `Phone | null`. The mutator accepts the VO, not a raw string.
- Do not persist, hash, or call `toJSON()` as a write.

## 3. Domain errors

Add to `domain/errors/employee.errors.ts` (same `DomainError` style, fixed message — controllers later map class → HTTP, not message matching):

| Class | Message | Typical HTTP (slice 3) |
|-------|---------|------------------------|
| `EmployeePersonalDataForbiddenError` | `Action not allowed` | `403` |
| `EmptyPersonalEmployeeDataError` | `At least one personal data field is required` | `400` |
| `InvalidEmployeeGenderError` | `Invalid gender` | `400` `InvalidParamError('gender')` |

`EmptyPersonalEmployeeDataError` is thrown by the resolver in slice 2. Define the class here; do not add the resolver in this slice.

Do not throw `EmployeeMainDataForbiddenError` or `EmployeeLifecycleForbiddenError` from this policy or this patch service. Do not reuse `EmptyMainEmployeeDataError`. Do not throw `InvalidParamError` from the domain (`InvalidParamError` is a presentation type).

## 4. `EmployeePersonalDataPolicy`

Files:

- `domain/services/employee-personal-data.policy.ts`
- co-located `employee-personal-data.policy.spec.ts`

**Class name:** `EmployeePersonalDataPolicy`. Implementation detail, not a glossary term.

Pure domain. **No** constructor ports. **No** intent enum. No Express, Mongoose, bcrypt, encrypter, `EmployeePoliciesService`, `EmployeeMainDataPolicy`, or `EmployeeLifecyclePolicy`.

```ts
assertCan(input: {
  actor: Employee
  target: Employee
}): void
```

`assertCan` is **sync**. Throw on refuse; return on allow. Do not return a boolean.

Copy the rule **order** from `EmployeeMainDataPolicy`. Swap only the forbidden class.

### Rules (this order, stop at first throw)

1. **Actor login-capable.** `actor.status` is `ACTIVE` or `VACATION`. Else → `ActorAuthenticationFailedError` (opaque; same class as lifecycle and main data). `INACTIVE` and `REMOVED` Actors fail here.
2. **Target already Removed.** `target.status === REMOVED` → `EmployeeAlreadyRemovedError`.
3. **Matrix**
   - Actor `EMPLOYEE` → `EmployeePersonalDataForbiddenError`.
   - Actor `MANAGER` → allow only if `target.role === EMPLOYEE` **and** `actor.id !== target.id`; else `EmployeePersonalDataForbiddenError`.
   - Actor `ADMIN` → allow any Target including self.

Last Admin does not apply. Step-up password does not apply. Do not call `EmployeeMainDataPolicy` or `EmployeeLifecyclePolicy`. Do not inspect the patch.

`requireRoles` will refuse `EMPLOYEE` at the route in slice 3. Rule 3 remains belt-and-braces.

Target `INACTIVE` or `VACATION` is **allowed** after step 2.

## 5. `EmployeePersonalDataPatchService`

Files:

- `domain/services/employee-personal-data-patch.service.ts`
- co-located `employee-personal-data-patch.service.spec.ts`

Pure, **synchronous**. No constructor. No outbound ports. No occupancy. Do not mark `apply` `async` — there is no I/O.

```ts
export type PersonalEmployeeDataField =
  | 'gender'
  | 'languages'
  | 'emergencyContact'
  | 'nif'
  | 'address';

export type PersonalEmployeeDataChanges = Partial<
  Record<PersonalEmployeeDataField, string | null>
>;

export type PersonalEmployeeDataPersistPatch = {
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
};

apply(
  target: Employee,
  changes: PersonalEmployeeDataChanges,
): PersonalEmployeeDataPersistPatch
```

Keys in `changes` are the present keys only. Values are `string | null`, never `undefined`. This service does not strip `undefined` and does not throw `EmptyPersonalEmployeeDataError` (the resolver does, in slice 2). An empty `changes` object returns `{}` and writes nothing on the entity.

| Field | `null` | non-null |
|-------|--------|----------|
| `gender` | `target.assignGender(null)`; patch `gender: null` | `EmployeeModel.isGender(value)` → `assignGender(value)`; else `InvalidEmployeeGenderError`. `''` is not a gender |
| `languages` | `assignLanguages(null)` | `assignLanguages(value)` — free string, stored as given, no trim |
| `emergencyContact` | `assignEmergencyContact(null)` | `Phone.create(value)` then `assignEmergencyContact(phone)`; patch stores `phone.value` |
| `nif` | `assignNif(null)` | `Nif.create(value)` then `assignNif(nif)`; patch stores `nif.value` (string). Do not `Number()` here |
| `address` | `assignAddress(null)` | `assignAddress(value)` — free string, stored as given, no trim |

Return only the keys that were on `changes`, with normalized values: VO `.value` for `emergencyContact` and `nif`; the enum string or the raw string for the others; `null` when cleared.

`Phone.create` / `Nif.create` errors propagate (`InvalidPhoneFormatError`, `InvalidNifError`). Do not catch them.

## Files

| File | Action |
|------|--------|
| `domain/models/employee.model.ts` + `employee.model.spec.ts` | `Gender`, `GENDERS`, `isGender` |
| `domain/entities/Employee.ts` + `employee.spec.ts` | four `assign*` mutators |
| `domain/errors/employee.errors.ts` | three new classes |
| `domain/services/employee-personal-data.policy.ts` + `*.spec.ts` | Create |
| `domain/services/employee-personal-data-patch.service.ts` + `*.spec.ts` | Create |
| `EmployeeMainDataPolicy` / `EmployeeLifecyclePolicy` / schema / HTTP / module | Do not change |

## Spec expectations

### `employee.model.spec.ts` (add)

Mirror the `Role` / `Status` blocks.

| `it(...)` | Assert |
|-----------|--------|
| exposes `GENDERS` | `['male', 'female', 'other']` |
| `isGender` accepts the three values | `true` for `'male'`, `'female'`, `'other'` and the enum members |
| `isGender` rejects non-genders | `false` for `null`, `''`, `'MALE'`, `'invalid'`, `123` |

### `employee.spec.ts` (add)

Mirror `assignNif`.

| `it(...)` | Assert |
|-----------|--------|
| `assignGender(Gender.MALE)` | `toJSON().gender === 'male'` |
| `assignGender(null)` | `toJSON().gender === null` |
| `assignLanguages` string then `null` | stores the string, then `null`; `'  pt  '` stays `'  pt  '` |
| `assignAddress` string then `null` | same, no trim |
| `assignEmergencyContact(Phone.create(...))` then `null` | stores `phone.value`, then `null` |
| existing `assignNif` | still assigns and clears |

### `employee-personal-data.policy.spec.ts`

`makeSut` / helper to reconstitute Actor/Target with role/status/id overrides. Hashed password via `Password.fromHash`. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP / ports.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EmployeePersonalDataPolicy` |
| ADMIN + Target EMPLOYEE / MANAGER / ADMIN (other id) | resolves |
| ADMIN + self | resolves |
| MANAGER + EMPLOYEE (other id) | resolves |
| MANAGER + self | `EmployeePersonalDataForbiddenError` |
| MANAGER + Target MANAGER | `EmployeePersonalDataForbiddenError` |
| MANAGER + Target ADMIN | `EmployeePersonalDataForbiddenError` |
| EMPLOYEE actor (any Target) | `EmployeePersonalDataForbiddenError` |
| Actor `VACATION` + otherwise allowed matrix | resolves |
| Actor `INACTIVE` | `ActorAuthenticationFailedError` |
| Actor `REMOVED` | `ActorAuthenticationFailedError` |
| Target `REMOVED` | `EmployeeAlreadyRemovedError` |
| Target `INACTIVE` + ADMIN Actor | resolves |
| Target `VACATION` + ADMIN Actor | resolves |
| Actor not login-capable is checked before Target Removed | Actor `INACTIVE` + Target `REMOVED` → `ActorAuthenticationFailedError` |

Assert the forbidden class with `toBeInstanceOf(EmployeePersonalDataForbiddenError)`. Run existing `employee-main-data.policy.spec.ts` and `employee-lifecycle.policy.spec.ts` — they must still pass unchanged.

### `employee-personal-data-patch.service.spec.ts`

`makeSut` → `new EmployeePersonalDataPatchService()` (no stubs, no ports). Target via `Employee.create` or `reconstitute` with the personal fields populated so a one-field patch can prove the others stayed. `apply` is called **without** `await` of a Promise — the return value is the patch object.

| `it(...)` | Assert |
|-----------|--------|
| `{ gender: 'male' }` | `assign` result `{ gender: 'male' }`; `toJSON().gender === 'male'` |
| `{ gender: null }` | patch `{ gender: null }`; entity gender cleared |
| `{ gender: 'invalid' }` / `{ gender: '' }` | `InvalidEmployeeGenderError`; entity gender unchanged |
| `{ languages: 'Português' }` | stored as given |
| `{ languages: null }` | cleared |
| `{ address: 'Rua X' }` / `{ address: null }` | set / clear; no trim on a spaced string |
| `{ emergencyContact: '+351 912 345 678' }` | patch value is `Phone.create(...).value`, not the raw input |
| `{ emergencyContact: null }` | patch `{ emergencyContact: null }` |
| `{ emergencyContact: '123' }` | `InvalidPhoneFormatError`; no assign |
| `{ nif: '123456789' }` | patch `{ nif: '123456789' }` (string, VO `.value`) |
| `{ nif: null }` | cleared via `assignNif(null)` |
| `{ nif: '00000000' }` | `InvalidNifError`; entity nif unchanged |
| one field present | returned patch has only that key |
| `{}` | returns `{}`; entity personal fields unchanged |

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] `Gender` values are `male` / `female` / `other`
- [ ] Policy is the only Personal Data matrix owner; main-data and lifecycle policies untouched
- [ ] `assertCan` is sync and has no ports
- [ ] `apply` is sync and has no ports
- [ ] No `patch*` helpers on the entity for personal fields
- [ ] `Employee.create` still does not validate gender
- [ ] Forbidden / empty / gender errors are new classes
- [ ] Co-located specs cover the tables
- [ ] Main-data and lifecycle specs still pass
- [ ] No schema / HTTP / use case / `adaptRoute` edits

## Out of scope

- `resolvePersonalEmployeeDataChanges` (slice 2 throws `EmptyPersonalEmployeeDataError`)
- `updatePersonalData` / `$set` / `Number(nif)`
- Controller blank-normalization of `languages` / `address`
- `EmployeeSnapshotMapper` (slice 2 forwards personal fields on reconstitute)
- Self-service policy

## Acceptance criteria

- [ ] `isGender('male' | 'female' | 'other')` is true; `null`, `''`, `'MALE'` are false
- [ ] `assignGender` / `assignLanguages` / `assignAddress` / `assignEmergencyContact` round-trip on `toJSON()`, including `null`
- [ ] ADMIN + any role Target (including self) → policy allows
- [ ] MANAGER + EMPLOYEE (other id) → allow; MANAGER + self / MANAGER / ADMIN → `EmployeePersonalDataForbiddenError`
- [ ] EMPLOYEE actor → forbidden
- [ ] Actor `VACATION` → allow; Actor `INACTIVE` / `REMOVED` → `ActorAuthenticationFailedError`
- [ ] Target `REMOVED` → `EmployeeAlreadyRemovedError`
- [ ] Target `INACTIVE` / `VACATION` → policy allows
- [ ] `gender: 'invalid'` and `gender: ''` → `InvalidEmployeeGenderError`; no mutation
- [ ] Invalid phone / invalid NIF → the existing VO error; no mutation
- [ ] Persist patch uses `phone.value` and `nif.value` (string), and only the keys that were present
- [ ] No new intent on `EmployeeMainDataPolicy`. Sibling policy specs still pass

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/employees/CONTEXT.md` |
| Enum style | `domain/models/employee.model.ts` (`Role`, `Status`, `isRole`) |
| Mutator precedent | `Employee.assignNif` |
| Policy to copy (do not edit) | `domain/services/employee-main-data.policy.ts` |
| Patch service shape (this one is sync and has no ports) | `domain/services/employee-main-data-patch.service.ts` |
| NIF / phone VOs | `@shared/domain` `Nif.create`, `Phone.create` |
| Next slice | [`01-persistence.md`](./01-persistence.md) |
