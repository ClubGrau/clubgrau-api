# Spec: Slice 0 — Domain (`changeUsername`, `EmployeeMainDataPolicy`)

> Pure domain of Update Main Employee Data.  
> Parent: [`README.md`](./README.md).  
> Depends on: none.  
> Design §7 / [ADR 0001](../../adr/update-main-employee-data/0001-main-data-policy-is-a-domain-service.md).  
> Jira: [KAN-21](https://paulodevmais.atlassian.net/browse/KAN-21).  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give the hexagon a `changeUsername` mutator and one `EmployeeMainDataPolicy` that the later command will call. The matrix, login-capable Actor, and Target-not-Removed live here — not on `EmployeeLifecyclePolicy`.

| Spec | Responsibility |
|------|----------------|
| **This file** | Entity mutator, new error, policy + specs |
| [`01-persistence.md`](./01-persistence.md) | `$set` of present Main Data keys |
| [`02-usecase.md`](./02-usecase.md) | Use case calls `assertCan` + occupancy skip |
| [`03-http-and-contract.md`](./03-http-and-contract.md) | HTTP maps the new error to `403` |
| `EmployeePoliciesService` | **Unchanged** — email occupancy only |
| `EmployeeLifecyclePolicy` | **Unchanged** — Deactivate / Reactivate / Vacation / Remove; Actor stays `ACTIVE`-only |

## When to use this spec

Use this document to change **domain only** (`domain/` + co-located specs).

| Artifact | This slice? |
|----------|-------------|
| `Employee.changeUsername(string \| null)` | Yes |
| `EmployeeMainDataForbiddenError` | Yes |
| `EmployeeMainDataPolicy.assertCan` + `*.spec.ts` | Yes |
| Occupancy skip / `exceptId` | **No** — slice 2 |
| Schema / repository / HTTP / wiring | **No** |
| New `LifecycleIntent` | **No** |
| Change lifecycle Actor to login-capable | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Update Main Employee Data following [`docs/specs/update-main-employee-data/00-domain.md`](./00-domain.md).  
> Add `Employee.changeUsername`, `EmployeeMainDataForbiddenError`, and `EmployeeMainDataPolicy.assertCan`.  
> Do not add a lifecycle intent. Do not change `EmployeeLifecyclePolicy` Actor to login-capable. Do not touch occupancy, Mongo, or HTTP.

## 1. `Employee` entity

File: `domain/entities/Employee.ts`.

Keep `changeName` / `changeEmail` / `changePhone`. Add:

```ts
changeUsername(username: string | null): void
```

Rules:

- No VO. Assign `this.props.username = username`.
- `null` clears. A non-null string is stored as given — **do not trim here**. Blank / whitespace → `null` is slice 2.
- This command will **never** call `changePhone(null)`. Leave `changePhone(null)` as-is (Anonymize).
- Do not persist, hash, or call `toJSON()` as a write.

`reconstitute` already defaults `username: input.username ?? null`. Do not change that default in this slice. Slice 2 must pass the snapshot username so the in-memory Target is not silently emptied.

`create` already accepts `username`. Unchanged.

## 2. Domain error

Add to `domain/errors/employee.errors.ts` (same `DomainError` style, fixed message — controllers later map class → HTTP, not message matching):

| Class | Message | Typical HTTP (slice 3) |
|-------|---------|------------------------|
| `EmployeeMainDataForbiddenError` | `Action not allowed` | `403` |

Same text idea as `EmployeeLifecycleForbiddenError`. **Do not** throw `EmployeeLifecycleForbiddenError` from this policy. Do not reuse that class.

Existing Actor / Removed / occupancy / not-found errors stay. This slice does not add new Actor or Removed classes.

## 3. `EmployeeMainDataPolicy`

Files:

- `domain/services/employee-main-data.policy.ts`
- co-located `employee-main-data.policy.spec.ts`

**Class name:** `EmployeeMainDataPolicy`. That name is an implementation detail, not a glossary term.

Pure domain. **No** constructor ports. **No** intent enum. No Express, Mongoose, bcrypt, encrypter, `EmployeePoliciesService`, or `EmployeeLifecyclePolicy`.

```ts
assertCan(input: {
  actor: Employee   // reconstituted
  target: Employee
}): void
```

`assertCan` is **sync**. Throw on refuse; return on allow. Do not return a boolean.

### Rules (this order, stop at first throw)

1. **Actor login-capable.** `actor.status` is `ACTIVE` or `VACATION`. Else → `ActorAuthenticationFailedError` (opaque; same class as lifecycle). `INACTIVE` and `REMOVED` Actors fail here.
2. **Target already Removed.** `target.status === REMOVED` → `EmployeeAlreadyRemovedError`.
3. **Matrix**
   - Actor `EMPLOYEE` → `EmployeeMainDataForbiddenError`.
   - Actor `MANAGER` → allow only if `target.role === EMPLOYEE` **and** `actor.id !== target.id`; else `EmployeeMainDataForbiddenError`.
   - Actor `ADMIN` → allow any Target including self.

Last Admin does not apply. Step-up password does not apply. Do not call `EmployeeLifecyclePolicy`. Do not inspect the patch (policy does not know which fields are present).

`requireRoles` will refuse `EMPLOYEE` at the route in slice 3. Rule 3 remains belt-and-braces (curl that bypasses the gate, future route mistake).

Target `INACTIVE` or `VACATION` is **allowed** after step 2 (not this command’s job to Reactivate).

## Files

| File | Action |
|------|--------|
| `domain/entities/Employee.ts` + `employee.spec.ts` | `changeUsername` |
| `domain/errors/employee.errors.ts` | `EmployeeMainDataForbiddenError` |
| `domain/services/employee-main-data.policy.ts` + `*.spec.ts` | Create |
| `EmployeeLifecyclePolicy` / occupancy / schema / HTTP / module | Do not change |

## Spec expectations

### `employee.spec.ts` (add)

Mirror existing `changeName` / `changePhone` style.

| `it(...)` | Assert |
|-----------|--------|
| `changeUsername` to a string | `toJSON().username` equals that string |
| `changeUsername(null)` | `toJSON().username === null` |
| `changeUsername` does not trim | `'  jdoe  '` stays `'  jdoe  '` (normalization is slice 2) |
| existing `changePhone(null)` | still clears phone (Anonymize path unchanged) |

### `employee-main-data.policy.spec.ts`

`makeSut` / helper to reconstitute Actor/Target with role/status/id overrides. Hashed password via `Password.fromHash`. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP / ports.

Required cases:

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `EmployeeMainDataPolicy` |
| ADMIN + Target EMPLOYEE / MANAGER / ADMIN (other id) | resolves |
| ADMIN + self | resolves |
| MANAGER + EMPLOYEE (other id) | resolves |
| MANAGER + self | `EmployeeMainDataForbiddenError` |
| MANAGER + Target MANAGER | `EmployeeMainDataForbiddenError` |
| MANAGER + Target ADMIN | `EmployeeMainDataForbiddenError` |
| EMPLOYEE actor (any Target) | `EmployeeMainDataForbiddenError` |
| Actor `VACATION` + otherwise allowed matrix | resolves (login-capable) |
| Actor `INACTIVE` | `ActorAuthenticationFailedError` |
| Actor `REMOVED` | `ActorAuthenticationFailedError` |
| Target `REMOVED` | `EmployeeAlreadyRemovedError` (after Actor is login-capable) |
| Target `INACTIVE` + ADMIN Actor | resolves |
| Target `VACATION` + ADMIN Actor | resolves |
| Actor not login-capable is checked before Target Removed | Actor `INACTIVE` + Target `REMOVED` → `ActorAuthenticationFailedError` |

Do **not** add a `LifecycleIntent`. Run existing `employee-lifecycle.policy.spec.ts` — it must still pass unchanged.

## Checklist (agent)

- [ ] Domain stays framework-free
- [ ] Policy is the only Main Data matrix owner; lifecycle and occupancy untouched
- [ ] `assertCan` is sync and has no ports
- [ ] Rule order matches this spec
- [ ] `EmployeeMainDataForbiddenError` is a new class (not `EmployeeLifecycleForbiddenError`)
- [ ] Co-located specs cover the tables
- [ ] Lifecycle specs still pass
- [ ] No schema / HTTP / use case / `adaptRoute` edits

## Out of scope

- Occupancy skip when email is unchanged
- `updateMainData` / `$set`
- Controller / route / `requireRoles`
- Changing lifecycle Actor to login-capable
- `get email()` (slice 2, if the use case needs it)

## Acceptance criteria

- [ ] ADMIN + any role Target (including self) → policy allows
- [ ] MANAGER + EMPLOYEE (other id) → allow; MANAGER + self / MANAGER / ADMIN → `EmployeeMainDataForbiddenError`
- [ ] EMPLOYEE actor → forbidden
- [ ] Actor `VACATION` → allow; Actor `INACTIVE` / `REMOVED` → `ActorAuthenticationFailedError`
- [ ] Target `REMOVED` → `EmployeeAlreadyRemovedError`
- [ ] Target `INACTIVE` / `VACATION` → policy allows
- [ ] No new `LifecycleIntent`. Lifecycle specs still pass
- [ ] `changeUsername('jdoe')` / `changeUsername(null)` round-trip on `toJSON().username`

## Reference map

| Concern | Look at |
|---------|---------|
| Glossary | `src/modules/employees/CONTEXT.md` |
| Entity today | `domain/entities/Employee.ts` |
| Lifecycle (do not merge) | `domain/services/employee-lifecycle.policy.ts` |
| Email occupancy (do not merge) | `domain/services/employee-policies.service.ts` |
| Why own policy | [ADR 0001](../../adr/update-main-employee-data/0001-main-data-policy-is-a-domain-service.md) |
| Next slice | [`01-persistence.md`](./01-persistence.md) |
