# Spec: Slice 0 — Domain (`changeJobTitle`, policy, patch service, count port)

> Pure domain of Update Professional Employee Data.  
> Parent: [`README.md`](./README.md).  
> Depends on: none.  
> Design §7. [ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md) · [ADR 0002](../../adr/update-professional-employee-data/0002-login-capable-admin-count-is-its-own-port.md).  
> Jira: TBD.  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give the hexagon a Job Title mutator, one `EmployeeProfessionalDataPolicy` (Job Title matrix + Role delta + Last Admin when leaving `ADMIN`), one pure `EmployeeProfessionalDataPatchService` (Job Title + Role only), and the `CountLoginCapableAdminsPort` **interface**. Status stays on `EmployeeLifecyclePolicy`. The count **query** is slice 1.

| Spec | Responsibility |
|------|----------------|
| **This file** | Mutator, two errors, count port interface, policy + patch service + specs |
| [`01-persistence.md`](./01-persistence.md) | `countLoginCapableAdmins` query + `updateProfessionalData` `$set` |
| [`02-usecase.md`](./02-usecase.md) | Use case calls professional policy, then lifecycle on a Status delta |
| [`03-http-and-contract.md`](./03-http-and-contract.md) | HTTP maps the new errors |
| `EmployeeMainDataPolicy` / `EmployeePersonalDataPolicy` | **Unchanged** |
| `EmployeeLifecyclePolicy` | **Unchanged** — no `CHANGE_ROLE` intent; Actor stays `ACTIVE`-only; constructor stays `CountActiveAdminsPort & CountNonRemovedAdminsPort` |
| `countActiveAdmins` / `CountActiveAdminsPort` | **Unchanged** |

## When to use this spec

Use this document to change **domain only** (`domain/` + co-located specs).

| Artifact | This slice? |
|----------|-------------|
| `Employee.changeJobTitle(string \| null)` | Yes |
| `EmployeeProfessionalDataForbiddenError`, `EmptyProfessionalEmployeeDataError` | Yes |
| `CountLoginCapableAdminsPort` (interface only) | Yes |
| `EmployeeProfessionalDataPolicy.assertCan` + spec | Yes |
| `EmployeeProfessionalDataPatchService.apply` + spec | Yes |
| Mongo `$set` / `countDocuments` / HTTP / use case / resolver | **No** |
| Lifecycle Actor → login-capable / new `LifecycleIntent` | **No** |
| `patchJobTitle` on `Employee` / Employment Id mutator | **No** |
| Status fields on the patch service | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Update Professional Employee Data following [`docs/specs/update-professional-employee-data/00-domain.md`](./00-domain.md).  
> Add `Employee.changeJobTitle`, `EmployeeProfessionalDataForbiddenError`, `EmptyProfessionalEmployeeDataError`, `CountLoginCapableAdminsPort` (interface only), `EmployeeProfessionalDataPolicy.assertCan`, and a synchronous `EmployeeProfessionalDataPatchService.apply`.  
> Do not add a lifecycle intent. Do not change `EmployeeLifecyclePolicy`. Do not implement the repository count. Do not add Mongo, HTTP, or the use case.

## 1. `Employee` — `changeJobTitle`

File: `domain/entities/Employee.ts`. Sit next to `changeRole`. Add:

```ts
changeJobTitle(jobTitle: string | null): void
```

Rules:

- Assign `this.props.jobTitle = jobTitle`. `null` clears.
- Store the value as given. **Do not trim.** Blank / whitespace → `null` is the patch service / controller (slice 2 / 3).
- Do not validate a placeholder. Do not touch `employmentId`.
- Do not add `patchJobTitle` on the entity. The patch service calls `changeJobTitle`.
- `changeRole` stays as it is (`InvalidEmployeeRoleError` on a non-enum).
- `reconstitute` already defaults `jobTitle: input.jobTitle ?? null`. Do not change that default in this slice. Slice 2 must pass the snapshot `jobTitle` so the in-memory Target is not silently emptied.
- Do not persist, hash, or call `toJSON()` as a write.

`create` already accepts `jobTitle`. Unchanged.

## 2. Domain errors

Add to `domain/errors/employee.errors.ts` (same `DomainError` style, fixed message — controllers later map class → HTTP, not message matching):

| Class | Message | Typical HTTP (slice 3) |
|-------|---------|------------------------|
| `EmployeeProfessionalDataForbiddenError` | `Action not allowed` | `403` |
| `EmptyProfessionalEmployeeDataError` | `At least one professional data field is required` | `400` |

`EmptyProfessionalEmployeeDataError` is thrown by the resolver in slice 2. Define the class here; do not add the resolver in this slice.

Do not throw `EmployeeMainDataForbiddenError`, `EmployeePersonalDataForbiddenError`, or `EmployeeLifecycleForbiddenError` from this policy or this patch service. Do not reuse `EmptyMainEmployeeDataError` / `EmptyPersonalEmployeeDataError`. Reuse existing `LastAdminProtectedError`, `ActorAuthenticationFailedError`, `EmployeeAlreadyRemovedError`, and `InvalidEmployeeRoleError`.

## 3. `CountLoginCapableAdminsPort`

File: `domain/ports/count-login-capable-admins.port.ts`, next to `count-active-admins.port.ts`.

```ts
export interface CountLoginCapableAdminsPort {
  countLoginCapableAdmins(): Promise<number>
}
```

Predicate (for the adapter in slice 1, and for policy specs that stub this port): `role === ADMIN` and `status ∈ { ACTIVE, VACATION }`.

Do **not** implement `countDocuments` in this slice. Do **not** change `CountActiveAdminsPort`. Do **not** inject `CountActiveAdminsPort` into the professional policy.

Why a new port: [ADR 0002](../../adr/update-professional-employee-data/0002-login-capable-admin-count-is-its-own-port.md). Widening `countActiveAdmins` would silently change Deactivate Last Admin.

## 4. `EmployeeProfessionalDataPolicy`

Files:

- `domain/services/employee-professional-data.policy.ts`
- co-located `employee-professional-data.policy.spec.ts`

**Class name:** `EmployeeProfessionalDataPolicy`. Implementation detail, not a glossary term.

Domain service. **No** Express, Mongoose, bcrypt, encrypter, `EmployeePoliciesService`, `EmployeeMainDataPolicy`, `EmployeePersonalDataPolicy`, or `EmployeeLifecyclePolicy`. No intent enum.

```ts
constructor(
  private readonly countPort: CountLoginCapableAdminsPort &
    CountNonRemovedAdminsPort,
) {}

async assertCan(input: {
  actor: Employee
  target: Employee
  roleChange: boolean
}): Promise<void>
```

`assertCan` is **async** (counts are I/O). Throw on refuse; resolve on allow. Do not return a boolean.

`roleChange` is `true` only when the body `role` is present **and** different from `target.role`. The use case computes it after both entities are reconstituted (slice 2). Echoed Role → `roleChange: false`. This class does not inspect a patch object.

Do not inject `CountActiveAdminsPort`. Do not change `EmployeeLifecyclePolicy`'s constructor.

### Rules (this order, stop at first throw)

1. **Actor login-capable.** `actor.status` is `ACTIVE` or `VACATION`. Else → `ActorAuthenticationFailedError` (opaque; same class as lifecycle and main / personal). `INACTIVE` and `REMOVED` Actors fail here.
2. **Target already Removed.** `target.status === REMOVED` → `EmployeeAlreadyRemovedError`.
3. **Matrix** (Job Title / any professional save, including Status-only that still enters this policy):
   - Actor `EMPLOYEE` → `EmployeeProfessionalDataForbiddenError`.
   - Actor `MANAGER` → allow only if `target.role === EMPLOYEE` **and** `actor.id !== target.id`; else `EmployeeProfessionalDataForbiddenError`.
   - Actor `ADMIN` → allow any Target including self.
4. **If `roleChange`:**
   - Actor is not `ADMIN` → `EmployeeProfessionalDataForbiddenError` (nothing else runs; **no counts**).
   - If Target **is** `ADMIN` (leaving `ADMIN`):
     - `countLoginCapableAdmins() === 1` → `LastAdminProtectedError` (do not call `countNonRemovedAdmins` after this throw).
     - else `countNonRemovedAdmins() === 1` → `LastAdminProtectedError`.
   - Promoting **to** `ADMIN`, or `MANAGER` → `EMPLOYEE`, or any other non-leaving-`ADMIN` delta, **never** hits the counts.

`requireRoles` will refuse `EMPLOYEE` at the route in slice 3. Rule 3 remains belt-and-braces.

Target `INACTIVE` or `VACATION` is **allowed** after step 2 (correcting Job Title / Role of an `INACTIVE` Target is not Reactivate).

Last Admin of Role reuses `LastAdminProtectedError` (same `409` as lifecycle). Do not invent a Role-specific Last Admin class.

Do not call `EmployeeMainDataPolicy`, `EmployeePersonalDataPolicy`, or `EmployeeLifecyclePolicy` from this class. Status is not this policy’s job ([ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md)).

## 5. `EmployeeProfessionalDataPatchService`

Files:

- `domain/services/employee-professional-data-patch.service.ts`
- co-located `employee-professional-data-patch.service.spec.ts`

Pure, **synchronous**. No constructor ports. No occupancy. Do not mark `apply` `async`. Status is **not** a field of this service.

```ts
export type ProfessionalEmployeeDataField = 'jobTitle' | 'role'

export type ProfessionalEmployeeDataChanges = {
  jobTitle?: string | null
  role?: EmployeeModel.Role
}

export type ProfessionalEmployeeDataPersistPatch = {
  jobTitle?: string | null
  role?: EmployeeModel.Role
}

apply(
  target: Employee,
  changes: ProfessionalEmployeeDataChanges,
): ProfessionalEmployeeDataPersistPatch
```

Keys in `changes` are the present keys only. Values are never `undefined`. This service does not strip `undefined` and does not throw `EmptyProfessionalEmployeeDataError` (the resolver does, in slice 2). An empty `changes` object returns `{}` and writes nothing on the entity.

Blank / whitespace → `null` for Job Title is this service’s job when the raw string is still blank. Slice 2 / 3 may already have forwarded `null`; treat `''` / whitespace-only the same as `null` so the entity never stores a blank Job Title.

| Field | Rule |
|-------|------|
| `jobTitle` present | Normalize blank / whitespace → `null`. `target.changeJobTitle(value)`. **Always** include `jobTitle` in the persist patch (even if the string equals the current value). |
| `role` present and **equal** to `target.role` | No-op. Do **not** call `changeRole`. Do **not** put `role` on the persist patch. |
| `role` present and **different** | `target.changeRole(value)`. Include `role` on the persist patch. |
| `role` present and not a `Role` | `InvalidEmployeeRoleError` (or let `changeRole` throw). Entity role unchanged. |

Return only the keys that belong on the persist patch after the table above. Do not include `status` / `deactivateAt` / `employmentId`.

## Files

| File | Action |
|------|--------|
| `domain/entities/Employee.ts` + `employee.spec.ts` | `changeJobTitle` |
| `domain/errors/employee.errors.ts` | two new classes |
| `domain/ports/count-login-capable-admins.port.ts` | Create (interface only) |
| `domain/services/employee-professional-data.policy.ts` + `*.spec.ts` | Create |
| `domain/services/employee-professional-data-patch.service.ts` + `*.spec.ts` | Create |
| `EmployeeLifecyclePolicy` / Main / Personal policies / schema / HTTP / module | Do not change |

## Spec expectations

### `employee.spec.ts` (add)

Mirror `changeRole` / `changeUsername`.

| `it(...)` | Assert |
|-----------|--------|
| `changeJobTitle('Barbeiro')` | `toJSON().jobTitle === 'Barbeiro'` |
| `changeJobTitle(null)` | `toJSON().jobTitle === null` |
| `changeJobTitle` does not trim | `'  Barbeiro  '` stays `'  Barbeiro  '` |
| existing `changeRole` | still assigns a valid Role and throws `InvalidEmployeeRoleError` on a non-enum |

### `employee-professional-data.policy.spec.ts`

`makeSut` / helper to reconstitute Actor/Target with role/status/id overrides. Hashed password via `Password.fromHash`. Stub `CountLoginCapableAdminsPort & CountNonRemovedAdminsPort` (`countLoginCapableAdmins` / `countNonRemovedAdmins` default `2`). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP. Default `roleChange: false` unless the case is a Role delta.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EmployeeProfessionalDataPolicy` |
| ADMIN + Target EMPLOYEE / MANAGER / ADMIN (other id), `roleChange: false` | resolves; counts **not** called |
| ADMIN + self, `roleChange: false` | resolves; counts **not** called |
| MANAGER + EMPLOYEE (other id), `roleChange: false` | resolves; counts **not** called |
| MANAGER + self | `EmployeeProfessionalDataForbiddenError` |
| MANAGER + Target MANAGER | `EmployeeProfessionalDataForbiddenError` |
| MANAGER + Target ADMIN | `EmployeeProfessionalDataForbiddenError` |
| EMPLOYEE actor (any Target) | `EmployeeProfessionalDataForbiddenError` |
| Actor `VACATION` + otherwise allowed matrix | resolves |
| Actor `INACTIVE` | `ActorAuthenticationFailedError` |
| Actor `REMOVED` | `ActorAuthenticationFailedError` |
| Target `REMOVED` | `EmployeeAlreadyRemovedError` |
| Target `INACTIVE` + ADMIN Actor | resolves |
| Target `VACATION` + ADMIN Actor | resolves |
| Actor not login-capable is checked before Target Removed | Actor `INACTIVE` + Target `REMOVED` → `ActorAuthenticationFailedError` |
| MANAGER + Target EMPLOYEE + `roleChange: true` | `EmployeeProfessionalDataForbiddenError`; counts **not** called |
| ADMIN + Target EMPLOYEE → Role `MANAGER` (`roleChange: true`) | resolves; counts **not** called |
| ADMIN + Target `MANAGER` → Role `EMPLOYEE` | resolves; counts **not** called |
| ADMIN + Target ADMIN → Role `MANAGER`, both counts `2` | resolves; both counts called |
| ADMIN + Target ADMIN leaving `ADMIN`, `countLoginCapableAdmins === 1` | `LastAdminProtectedError`; `countNonRemovedAdmins` **not** called |
| ADMIN + Target ADMIN leaving `ADMIN`, login-capable `2`, `countNonRemovedAdmins === 1` | `LastAdminProtectedError` |
| ADMIN + Target ADMIN leaving `ADMIN`, Target is `VACATION`, `countLoginCapableAdmins === 1` | `LastAdminProtectedError` |
| Job Title-only (`roleChange: false`) on Last Admin Target | resolves; counts **not** called |
| `roleChange: false` never calls counts | even when Target is ADMIN and counts would be `1` |

Assert the forbidden class with `toBeInstanceOf(EmployeeProfessionalDataForbiddenError)`. Run existing `employee-main-data.policy.spec.ts`, `employee-personal-data.policy.spec.ts`, and `employee-lifecycle.policy.spec.ts` — they must still pass unchanged.

### `employee-professional-data-patch.service.spec.ts`

`makeSut` → `new EmployeeProfessionalDataPatchService()` (no stubs, no ports). Target via `Employee.create` or `reconstitute` with `jobTitle` and `role` populated so a one-field patch can prove the other stayed. `apply` is called **without** `await`.

| `it(...)` | Assert |
|-----------|--------|
| `{ jobTitle: 'Barbeiro' }` | patch `{ jobTitle: 'Barbeiro' }`; `toJSON().jobTitle === 'Barbeiro'` |
| `{ jobTitle: null }` | patch `{ jobTitle: null }`; entity Job Title cleared |
| `{ jobTitle: '' }` / `{ jobTitle: '   ' }` | patch `{ jobTitle: null }`; entity cleared |
| `{ jobTitle }` equal to the current string | still returns `{ jobTitle }` (always persist when present) |
| `{ role }` equal to `target.role` | returns `{}`; `changeRole` not called; entity role unchanged |
| `{ role }` different | `changeRole` applied; patch includes `role` |
| `{ role: 'ROOT' }` (or any non-enum) | `InvalidEmployeeRoleError`; entity role unchanged |
| `{ jobTitle: 'Barbeiro', role }` equal to current | patch `{ jobTitle: 'Barbeiro' }` only |
| `{ jobTitle: 'Barbeiro', role }` different | patch has both keys |
| `{}` | returns `{}`; entity professional fields unchanged |

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] `changeJobTitle` does not trim and does not touch `employmentId`
- [ ] Policy is the only professional matrix / Role-delta owner; main, personal, and lifecycle policies untouched
- [ ] `assertCan` is async and takes `roleChange`
- [ ] Constructor is `CountLoginCapableAdminsPort & CountNonRemovedAdminsPort` — not `CountActiveAdminsPort`
- [ ] Counts run only when leaving `ADMIN` on a Role delta; promote / echo / Job Title-only / MANAGER Role delta do not call them
- [ ] `apply` is sync and has no ports; Status is not a field
- [ ] Echoed Role is omitted from the persist patch; present Job Title is always included
- [ ] Forbidden / empty errors are new classes; Last Admin reuses `LastAdminProtectedError`
- [ ] Co-located specs cover the tables
- [ ] Main / personal / lifecycle specs still pass
- [ ] No schema / HTTP / use case / repository count / `adaptRoute` edits

## Out of scope

- `resolveProfessionalEmployeeDataChanges` (slice 2 throws `EmptyProfessionalEmployeeDataError`)
- `countLoginCapableAdmins` `countDocuments` / `updateProfessionalData` `$set`
- Controller blank-normalization of `jobTitle` / rejection of null `role` / `status`
- `EmployeeSnapshotMapper` (slice 2 forwards `jobTitle` on reconstitute)
- Status transitions / `EmployeeLifecyclePolicy`
- Self-service policy

## Acceptance criteria

- [ ] `changeJobTitle('Barbeiro')` / `changeJobTitle(null)` round-trip on `toJSON().jobTitle`
- [ ] ADMIN + any role Target (including self), `roleChange: false` → policy allows; counts not called
- [ ] MANAGER + EMPLOYEE (other id), `roleChange: false` → allow; MANAGER + self / MANAGER / ADMIN → `EmployeeProfessionalDataForbiddenError`
- [ ] EMPLOYEE actor → forbidden
- [ ] Actor `VACATION` → allow; Actor `INACTIVE` / `REMOVED` → `ActorAuthenticationFailedError`
- [ ] Target `REMOVED` → `EmployeeAlreadyRemovedError`
- [ ] Target `INACTIVE` / `VACATION` → policy allows
- [ ] MANAGER + `roleChange: true` → `EmployeeProfessionalDataForbiddenError`; no counts
- [ ] ADMIN promoting EMPLOYEE → `MANAGER` → allow; no counts
- [ ] ADMIN + Last Admin leaving `ADMIN` (`countLoginCapableAdmins === 1`) → `LastAdminProtectedError`
- [ ] Last login-capable ADMIN is `VACATION` + leaving `ADMIN` → `LastAdminProtectedError`
- [ ] `{ jobTitle: null }` / blank → persist patch `{ jobTitle: null }`
- [ ] Echoed Role → empty persist patch; Role delta → patch includes `role`
- [ ] No new `LifecycleIntent`. Sibling policy specs still pass

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/employees/CONTEXT.md` |
| Mutator family | `Employee.changeRole` |
| Count port style | `domain/ports/count-active-admins.port.ts` |
| Policy matrix to copy (do not edit; swap the forbidden class) | `domain/services/employee-main-data.policy.ts` |
| Async count + Last Admin pattern (do not edit) | `domain/services/employee-lifecycle.policy.ts` |
| Patch service shape (this one is sync and has no ports) | `domain/services/employee-personal-data-patch.service.ts` |
| Why own policy + reused lifecycle | [ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md) |
| Why a new count port | [ADR 0002](../../adr/update-professional-employee-data/0002-login-capable-admin-count-is-its-own-port.md) |
| Next slice | [`01-persistence.md`](./01-persistence.md) |
