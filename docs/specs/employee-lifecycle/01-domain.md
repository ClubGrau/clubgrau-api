# Spec: Slice 1 — Domain lifecycle (`REMOVED`, policy, `anonymize`)

> Pure domain of Deactivate / Reactivate / Vacation / Remove.  
> Parent: [`README.md`](./README.md).  
> Depends on: none of the later slices (shared helpers from [`00`](./00-adapt-route-and-http-helpers.md) are unused here).  
> Design §7 / [ADR 0010](../../adr/remove-or-inactivate-emp/0010-lifecycle-policy-is-a-domain-service.md) / [ADR 0013](../../adr/remove-or-inactivate-emp/0013-removed-is-a-status-enum-value.md).  
> Next: [`02-persistence.md`](./02-persistence.md).

## Responsibility (this spec only)

Give the hexagon a **terminal** `REMOVED` status, an `anonymize()` behavior, and one `EmployeeLifecyclePolicy` that both later commands will call.

| Spec | Responsibility |
|------|----------------|
| **This file** | Model, entity, errors, domain port, policy + specs |
| [`02-persistence.md`](./02-persistence.md) | Schema / mapper / repo implement the count port |
| [`03-update-employee-status.md`](./03-update-employee-status.md) | Use case calls `assertCan` |
| [`04-remove-employee.md`](./04-remove-employee.md) | Use case calls `assertCan(REMOVE)` + persist anonymize |
| `EmployeePoliciesService` | **Unchanged** — create-time email occupancy only |

## When to use this spec

Use this document to change **domain only** (`domain/` + the smallest compile seams listed below).

| Artifact | This slice? |
|----------|-------------|
| `EmployeeModel.Status.REMOVED`, `OPERATIONAL_STATUSES`, `isOperationalStatus` | Yes |
| `Employee.anonymize()`, `removedAt` on props, `get role()` | Yes |
| New domain errors | Yes |
| `CountNonRemovedAdminsPort` (domain outbound) | Yes — interface only |
| `EmployeeLifecyclePolicy` + `*.spec.ts` | Yes |
| Compile seams in `UpdateEmployeeStatusUsecase` / existing reconstitutes | Yes — see [Compile seams](#compile-seams) |
| Schema / repository / HTTP / wiring | **No** |
| Hashing passwords inside `anonymize()` | **No** — no I/O in domain |

**Prompt sketch for the agent:**

> Implement slice 1 of employee lifecycle following [`docs/specs/employee-lifecycle/01-domain.md`](./01-domain.md).  
> Add `REMOVED` + `isOperationalStatus`, `Employee.anonymize()`, lifecycle errors, `CountNonRemovedAdminsPort`, and `EmployeeLifecyclePolicy.assertCan`.  
> Do not touch schema, HTTP, or Remove use case. Keep `EmployeePoliciesService` as email occupancy.

## 1. `EmployeeModel.Status`

File: `domain/models/employee.model.ts`.

```ts
enum Status { ACTIVE, INACTIVE, VACATION, REMOVED }

type OperationalStatus = Status.ACTIVE | Status.INACTIVE | Status.VACATION

OPERATIONAL_STATUSES = freeze([ACTIVE, INACTIVE, VACATION])
STATUSES            = freeze(Object.values(Status)) // includes REMOVED

isStatus(value)              // reconstitution, persistence — full enum
isOperationalStatus(value)   // update-status body, list query — subset
```

Rules:

- `isStatus('REMOVED')` is **true**.
- `isOperationalStatus('REMOVED')` is **false**.
- `isOperationalStatus` is a type guard for `OperationalStatus`.
- `create` still defaults `ACTIVE`. HTTP still must not accept `REMOVED` as a body/query value — that validation is slices 3 and 5; this slice only provides the guard.

Update `employee.model.spec.ts`: `STATUSES` includes `REMOVED`; add cases for `isOperationalStatus` (accept three operational values; reject `REMOVED`, `'active'`, `null`).

## 2. `Employee` entity

### Props

Add `removedAt: Date | null`.

- `create`: `removedAt = null`.
- `reconstitute`: accept `removedAt?: Date | null`; default `null` so existing callers compile.
- `toJSON()` will include `removedAt` automatically via the entity base.

Add `get role(): EmployeeModel.Role` (policy must not poke `.props` for role/status/id). `status` and `id` already exist.

### `anonymize()`

Precondition: current status is `INACTIVE`. Otherwise:

| Current status | Throw |
|----------------|-------|
| `REMOVED` | `EmployeeAlreadyRemovedError` |
| anything else (`ACTIVE`, `VACATION`) | `EmployeeNotInactiveError` |

On success (no I/O):

| Field | After |
|-------|--------|
| `status` | `REMOVED` |
| `removedAt` | `now` (`new Date()`) |
| `name` | `Name.create('Removed')` |
| `email` | `Email.create(\`removed.${this.id}@anonymized.invalid\`)` |
| `phone` | `null` |
| `nif` | `null` |
| `id` / `role` / `deactivateAt` / `createdAt` | unchanged |
| `password` | unchanged — use case hashes a random secret later |

`Name.create('Removed')` satisfies `MIN_LENGTH`. Sentinel email matches the shared `Email` regex (`.invalid` TLD is fine).

Do **not** persist, hash, or call `toJSON()` as a write. Do **not** add `remove()` as an alias — the glossary verb on the entity is **Anonymize**.

### Operational transitions vs `REMOVED`

`activate` / `deactivate` / `putOnVacation`: if current status is `REMOVED`, throw `EmployeeAlreadyRemovedError` **before** the already-in-status checks. Removed is terminal; these methods must not resurrect.

## 3. Domain errors

Add to `domain/errors/employee.errors.ts` (same `DomainError` style, fixed messages — controllers later map class → HTTP, not message matching):

| Class | Message | Typical HTTP (later slices) |
|-------|---------|-----------------------------|
| `ActorAuthenticationFailedError` | `Authentication failed` | `401` opaque (same text as auth `AuthenticationError`) |
| `EmployeeLifecycleForbiddenError` | `Action not allowed` | `403` |
| `LastAdminProtectedError` | `Last Admin must stay ACTIVE until another Admin exists` | `409` |
| `EmployeeNotInactiveError` | `Employee is not inactive` | `409` |
| `EmployeeAlreadyRemovedError` | `Employee is already removed` | `409` |

Existing already-in-status / not-found errors stay. Do not reuse `AuthenticationError` from the auth hexagon (cross-module domain import is forbidden).

## 4. `CountNonRemovedAdminsPort`

File: `domain/ports/count-non-removed-admins.port.ts`.

```ts
export interface CountNonRemovedAdminsPort {
  countNonRemovedAdmins(): Promise<number>;
}
```

This is a **domain** outbound port (policy is a domain service). The repository implements it in slice 2. Query meaning: `{ role: ADMIN, status: { $ne: REMOVED } }` — `INACTIVE` / `VACATION` ADMINs still count (legacy). Do not implement the query here.

## 5. `EmployeeLifecyclePolicy`

Files:

- `domain/services/employee-lifecycle.policy.ts` (or `employee-lifecycle-policy.service.ts` if you prefer kebab matching `employee-policies.service.ts` — **name the class `EmployeeLifecyclePolicy`**)
- co-located `*.spec.ts`

Pure domain. Constructor injects `CountNonRemovedAdminsPort` only. No Express, Mongoose, bcrypt, encrypter, or `EmployeePoliciesService`.

```ts
export type LifecycleIntent = 'DEACTIVATE' | 'REACTIVATE' | 'VACATION' | 'REMOVE'

assertCan(input: {
  actor: Employee
  target: Employee
  intent: LifecycleIntent
}): Promise<void>
```

`assertCan` is **async** because Last Admin counting is I/O. Throw on refuse; resolve on allow. Do not return a boolean.

### Rules (this order, stop at first throw)

1. **Actor usable.** `actor.status !== ACTIVE` → `ActorAuthenticationFailedError`. Do not call the count port.
2. **Self-Remove.** `actor.id === target.id` **and** `intent === 'REMOVE'` → `EmployeeLifecycleForbiddenError`. (Statuses already differ in the happy path; this is belt-and-braces.)
3. **Target already Removed.** `target.status === REMOVED` (any intent) → `EmployeeAlreadyRemovedError`. Terminal; no lifecycle command applies.
4. **Matrix**
   - Actor `EMPLOYEE` → `EmployeeLifecycleForbiddenError` (all intents).
   - Actor `MANAGER` → allow `DEACTIVATE` / `REACTIVATE` / `VACATION` only if `target.role === EMPLOYEE`; else forbidden. `REMOVE` → always forbidden.
   - Actor `ADMIN` → allow all intents on any role, except steps 5–6.
5. **Last Admin.** If `target.role === ADMIN` **and** intent is `DEACTIVATE` \| `VACATION` \| `REMOVE`:
   - `count = await countNonRemovedAdmins()`
   - if `count === 1` → `LastAdminProtectedError`
   - `REACTIVATE` of a leftover `INACTIVE` ADMIN is **allowed** for an ADMIN actor (do not call count / do not throw Last Admin).
6. **Remove extra.** If `intent === 'REMOVE'` and `target.status !== INACTIVE` → `EmployeeNotInactiveError`.

Call `countNonRemovedAdmins` **only** in step 5 when the Last Admin check actually runs. Matrix refusals and non-ADMIN targets must not hit the port (keeps tests honest and avoids extra I/O).

`VACATION` is an operational intent. On the matrix it follows **Deactivate** (MANAGER → `EMPLOYEE` only; ADMIN → any role except Last Admin leaving `ACTIVE`).

## Compile seams (required so the hexagon still builds)

Adding `REMOVED` makes `UpdateEmployeeStatusUsecase.applyTransition`’s exhaustive `switch` fail TypeScript.

In **this** slice, add:

```ts
case EmployeeModel.Status.REMOVED:
  throw new InvalidEmployeeStatusError(`Invalid status: "${status}"`);
```

Do **not** inject the policy, `actorId`, or HTTP mapping. Slice 3 replaces this with “controller already rejected `REMOVED`” plus policy.

Any `ReconstituteEmployeeProps` fixture that becomes incomplete: pass `removedAt: null` or rely on the optional default.

Do not “fix” list/update-status HTTP to `isOperationalStatus` here (slices 3 and 5). Existing `it.each(Object.values(EmployeeModel.Status))` on the update-status controller will start iterating `REMOVED` — **leave it**. Slice 3 changes that test. If CI fails because the port is called with `REMOVED` and the use case now throws, either:

- skip/adjust **only** that `it.each` to `OPERATIONAL_STATUSES` as a one-line seam, or
- let the case expect the use case not to be reached — prefer adjusting `it.each` to operational values so slice 3’s controller change stays the real HTTP gate.

Do not change `GetEmployeesController` in this slice.

## Files

| File | Action |
|------|--------|
| `domain/models/employee.model.ts` + `*.spec.ts` | `REMOVED`, operational guard |
| `domain/entities/Employee.ts` + `employee.spec.ts` | `removedAt`, `role` getter, `anonymize()`, terminal guard on operational methods |
| `domain/errors/employee.errors.ts` | five new errors |
| `domain/ports/count-non-removed-admins.port.ts` | Create |
| `domain/services/employee-lifecycle.policy.ts` + `*.spec.ts` | Create |
| `application/usecases/update-employee-status.usecase.ts` | `REMOVED` branch throws `InvalidEmployeeStatusError` only |
| Schema, repo, controllers, module, `.http` | Do not change |

## Spec expectations

### `employee.model.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| statuses include `REMOVED` | `STATUSES` equals `['ACTIVE','INACTIVE','VACATION','REMOVED']` |
| `isStatus('REMOVED')` | `true` |
| `isOperationalStatus` accepts ACTIVE/INACTIVE/VACATION | `true` |
| `isOperationalStatus('REMOVED')` | `false` |
| `isOperationalStatus('active')` / `null` | `false` |

### `employee.spec.ts` (add)

Mirror existing `makeSnapshot` / `create` style.

| `it(...)` | Assert |
|-----------|--------|
| `create` defaults `removedAt` to `null` | `toJSON().removedAt === null` |
| `reconstitute` keeps a provided `removedAt` | date round-trips |
| `anonymize` on `INACTIVE` sets sentinels + `REMOVED` + `removedAt` Date | name `Removed`; email `removed.<id>@anonymized.invalid`; phone/nif null; role and id unchanged; password unchanged |
| `anonymize` on `ACTIVE` | `EmployeeNotInactiveError` |
| `anonymize` on `VACATION` | `EmployeeNotInactiveError` |
| `anonymize` on already `REMOVED` | `EmployeeAlreadyRemovedError` |
| `activate` / `deactivate` / `putOnVacation` on `REMOVED` | `EmployeeAlreadyRemovedError` |
| `get role` | matches reconstituted role |

### `employee-lifecycle.policy.spec.ts`

`makeStubs` / `makeSut` / `SutTypes`. Stub `CountNonRemovedAdminsPort` (`countNonRemovedAdmins: jest.fn().mockResolvedValue(2)`). Build Actor/Target via `Employee.reconstitute` (hashed password). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

Helper to reconstitute with role/status overrides.

Required cases:

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EmployeeLifecyclePolicy` |
| Actor not `ACTIVE` (INACTIVE / VACATION / REMOVED) | `ActorAuthenticationFailedError`; count **not** called |
| Actor `EMPLOYEE` any intent | `EmployeeLifecycleForbiddenError`; count **not** called |
| Actor `MANAGER` + Target `EMPLOYEE` + DEACTIVATE / REACTIVATE / VACATION | resolves; count **not** called |
| Actor `MANAGER` + Target `EMPLOYEE` + REMOVE | forbidden; count **not** called |
| Actor `MANAGER` + Target `MANAGER` or `ADMIN` (any intent) | forbidden |
| Actor `ADMIN` + Target `EMPLOYEE`/`MANAGER` + DEACTIVATE / REACTIVATE / VACATION / REMOVE (Target INACTIVE for REMOVE) | resolves |
| Actor `ADMIN` + REMOVE while Target `ACTIVE` or `VACATION` | `EmployeeNotInactiveError` |
| Actor `ADMIN` + any intent on Target `REMOVED` | `EmployeeAlreadyRemovedError` |
| Self-Remove (`actor.id === target.id`, intent REMOVE) | forbidden |
| Last Admin (`count === 1`) + DEACTIVATE / VACATION / REMOVE on ADMIN Target | `LastAdminProtectedError`; count called once |
| Last Admin + REACTIVATE of INACTIVE ADMIN | resolves; count **not** called |
| Two ADMINs (`count === 2`) + ADMIN Actor REMOVE INACTIVE ADMIN Target | resolves |
| `EMPLOYEE` / `MANAGER` refusals do not call count | already covered; keep explicit |
| Count port rejection | propagate the same error |

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] `isStatus` includes `REMOVED`; HTTP subset is `isOperationalStatus`
- [ ] `anonymize()` has no I/O and does not hash
- [ ] Policy is the only matrix/Last-Admin owner; `EmployeePoliciesService` untouched
- [ ] `CountNonRemovedAdminsPort` lives under `domain/ports/`
- [ ] `assertCan` rule order matches this spec
- [ ] Co-located specs cover the tables
- [ ] Hexagon still compiles (REMOVED switch seam)
- [ ] No schema / HTTP / Remove use case / `adaptRoute` edits in this slice (unless slice 0 is already done — do not redo it)

## Out of scope

- Persisting sentinels / `removedAt`
- Step-up password
- List exclusion (repo)
- Controller HTTP map
- JWT re-check

## Acceptance criteria

- [ ] `EmployeeModel.isOperationalStatus('REMOVED') === false` and `isStatus('REMOVED') === true`
- [ ] `INACTIVE` employee `anonymize()` → `REMOVED` + sentinels; original role/id kept
- [ ] MANAGER cannot `assertCan` REMOVE or act on MANAGER/ADMIN
- [ ] Last Admin DEACTIVATE / VACATION / REMOVE → `LastAdminProtectedError`
- [ ] ADMIN may REACTIVATE a leftover INACTIVE ADMIN
- [ ] Policy + entity + model specs pass
- [ ] `EmployeePoliciesService` specs still pass unchanged

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/employees/CONTEXT.md` |
| Entity today | `domain/entities/Employee.ts` |
| Email occupancy (do not merge) | `domain/services/employee-policies.service.ts` |
| Name / Email VOs | `@shared/domain/value-object` |
| Why domain service | [ADR 0010](../../adr/remove-or-inactivate-emp/0010-lifecycle-policy-is-a-domain-service.md) |
| Why enum value | [ADR 0013](../../adr/remove-or-inactivate-emp/0013-removed-is-a-status-enum-value.md) |
| Next slice | [`02-persistence.md`](./02-persistence.md) |
