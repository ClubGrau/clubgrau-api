# Spec: Slice 2 — `UpdateMainEmployeeDataUsecase`

> Application command: Actor/Target, policy, occupancy except self, mutators, persist patch.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), [`01-persistence.md`](./01-persistence.md).  
> Design §8.  
> Jira: [KAN-23](https://paulodevmais.atlassian.net/browse/KAN-23).  
> Next: [`03-http-and-contract.md`](./03-http-and-contract.md).

## Responsibility (this spec only)

Orchestrate Update Main Employee Data behind an inbound port. Occupancy stays `EmployeePoliciesService.ensureEmailIsAvailable` — this command **skips** the call when email is omitted or equal to the Target after `Email.create` (trim + lower-case). Do not change the occupancy service signature.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Policy + `changeUsername` |
| [`01`](./01-persistence.md) | `updateMainData` |
| **This file** | DTO + inbound port + use case + spec |
| [`03`](./03-http-and-contract.md) | Controller / route / `AGENT.md` |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `UpdateMainEmployeeDataDto` + result DTO | Yes |
| Inbound `UpdateMainEmployeeDataPort` | Yes |
| `UpdateMainEmployeeDataUsecase` + spec | Yes |
| `Employee.get email()` (if needed to compare without `toJSON`) | Yes — small entity seam |
| Controller / route / module HTTP wiring | **No** |
| `AGENT.md` living contract | **No** — slice 3 |
| `exceptId` on `ensureEmailIsAvailable` | **No** |
| Encrypter / `CompareHashPort` / lifecycle policy | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Update Main Employee Data following [`docs/specs/update-main-employee-data/02-usecase.md`](./02-usecase.md).  
> Load Actor and Target, call `EmployeeMainDataPolicy.assertCan`, skip `ensureEmailIsAvailable` when email is omitted or equal after `Email.create`, apply mutators for present keys, persist the patch.  
> Reconstitute with snapshot `username`. Never `changePhone(null)`. Do not add the controller or route.

## Application contracts

### DTO — `application/dtos/update-main-employee-data.dto.ts`

```ts
interface UpdateMainEmployeeDataDto {
  actorId: string                 // adaptRoute; never from the client body
  id: string                      // path :id
  name?: string
  email?: string
  phone?: string
  username?: string | null        // present + blank/null → clear
}

interface UpdateMainEmployeeDataResultDto {
  id: string
}
```

Inbound DTO only contains keys the controller decided were present. The repository `$set`s exactly those keys (`username` may be `null`).

### Inbound port — `application/ports/inbound/update-main-employee-data.port.ts`

```ts
interface UpdateMainEmployeeDataPort {
  execute(params: UpdateMainEmployeeDataDto): Promise<UpdateMainEmployeeDataResultDto>
}
```

## Use case flow (normative)

Constructor:

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  employeePoliciesService: EmployeePoliciesService,
  mainDataPolicy: EmployeeMainDataPolicy,
  updateMainDataRepository: UpdateMainEmployeeDataRepositoryPort,
)
```

Same repository instance will implement find + email + `updateMainData` in the module (slice 3). Inject the ports; do not construct adapters.

```text
execute({ actorId, id, name?, email?, phone?, username? })
  1. actorId empty/blank → ActorAuthenticationFailedError
  2. findById(actorId) — miss → same 401 error
  3. findById(id) — miss → EmployeeNotFoundError
  4. Employee.reconstitute Actor and Target
       Password.fromHash
       username: snapshot.username ?? null
       removedAt: snapshot.removedAt ?? null
       never Employee.create
  5. mainDataPolicy.assertCan({ actor, target })
  6. For each present field, validate and mutate:
       name     → Name.create → changeName
       email    → Email.create
                  if email.value !== target.email.value
                    → ensureEmailIsAvailable(email.value)
                  changeEmail
       phone    → Phone.create (not null) → changePhone
       username → trim; '' → null; changeUsername
  7. updateMainData({ id, ...present normalized values })
       omit keys that were omitted on the DTO
  8. return { id }
```

If steps 1–6 throw, **do not** call `updateMainData`.

Load Actor **before** Target. Actor miss is `ActorAuthenticationFailedError`, not `EmployeeNotFoundError`.

`findById` is called twice (two ids). Specs must assert both calls.

### Presence and normalize

| DTO key | Present when | Normalize before persist |
|---------|--------------|--------------------------|
| `name` | `!== undefined` | `Name.create` → string via VO (`toJSON()` / `.value`) |
| `email` | `!== undefined` | `Email.create` → lower-cased value |
| `phone` | `!== undefined` | `Phone.create` → VO string (never `null`) |
| `username` | `!== undefined` (`null` is present) | `String` trim; `''` → `null` |

The controller is the HTTP gate for empty patch / blank name|email|phone / `status`|`password`. If the use case is called with **no** Main Data keys, do **not** persist an empty `$set` — throw a small application/domain error (maps to `400` in slice 3) or treat it as a programming error. Prefer throw; never `updateMainData({})`.

Never `changePhone(null)`.

### Occupancy skip

Compare **after** `Email.create` so case is not a false collision (`Foo@Bar.com` vs stored `foo@bar.com` → skip).

| Email on DTO | Occupancy |
|--------------|-----------|
| omitted | do not call `ensureEmailIsAvailable` |
| present and `email.value === target.email.value` | do not call |
| present and different | call with the **new** value; persist if it resolves |

Do **not** add `{ exceptId }` to `EmployeePoliciesService`. Create’s signature stays `ensureEmailIsAvailable(email)`.

If occupancy throws `EmployeeAlreadyExistsError` / `EmployeeInactiveError`, do not persist.

### Entity seam — `get email()`

`Employee` today has no `email` getter (`toJSON()` is the write snapshot). Add:

```ts
get email(): Email {
  return this.props.email
}
```

Use `target.email.value` in the skip compare. Do not persist `employee.toJSON()` (`Password.toJSON()` is `'[REDACTED]'`).

## Files

| File | Action |
|------|--------|
| `application/dtos/update-main-employee-data.dto.ts` | Create |
| `application/ports/inbound/update-main-employee-data.port.ts` | Create |
| `application/usecases/update-main-employee-data.usecase.ts` + `*.spec.ts` | Create |
| `domain/entities/Employee.ts` + `employee.spec.ts` | `get email()` only if used |
| Controller / routes / `employees.module.ts` / `AGENT.md` / `.http` | Do not change |

## Spec expectations (`update-main-employee-data.usecase.spec.ts`)

`makeStubs` / `makeSut` / `SutTypes`. Stub `FindEmployeeByIdPort`, `EmployeePoliciesService` (`ensureEmailIsAvailable: jest.fn().mockResolvedValue(undefined)`), `EmployeeMainDataPolicy` (`assertCan: jest.fn()`), `UpdateMainEmployeeDataRepositoryPort`. Default snapshots: Actor ADMIN ACTIVE (different id), Target EMPLOYEE ACTIVE with a known `username` (e.g. `'old.user'`) so reconstituting without it would fail a later assertion.

`findById` must dispatch by id (Actor vs Target). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdateMainEmployeeDataUsecase` |
| missing / blank `actorId` | `ActorAuthenticationFailedError`; no Target `findById`; no persist |
| Actor `findById` null | `ActorAuthenticationFailedError`; no persist |
| Target `findById` null | `EmployeeNotFoundError`; no persist |
| `should call findById with actorId then target id` | both ids |
| `assertCan` throw forbidden / actor-auth / already-removed | propagate; no persist |
| `{ name }` only | persist `{ id, name }`; occupancy **not** called; `changePhone` not called |
| omitted email | occupancy not called |
| same email as Target, different case | occupancy not called; persist includes **normalized** email if the key was present |
| new free email | occupancy called with the new value; persist includes email |
| new email held by `ACTIVE` | `EmployeeAlreadyExistsError`; no persist |
| new email held by `INACTIVE` | `EmployeeInactiveError`; no persist |
| `{ username: '' }` / whitespace / `null` | persist `{ id, username: null }` |
| `{ username: '  jdoe  ' }` | persist `{ id, username: 'jdoe' }` (trim) |
| `{ phone }` | `Phone.create` then persist phone string; never `changePhone(null)` |
| invalid present `name` / `email` / `phone` | VO error; no persist |
| no Main Data keys | throw; no persist |
| `Password.fromHash` on load | spy; `Password.create` not used |
| reconstitute receives `username` from snapshot | Target with `username: 'old.user'` — a name-only persist still does not pass `username` to `updateMainData` |
| no Encrypter / CompareHash / lifecycle policy deps | constructor arity / absence |

## Checklist (agent)

- [ ] Actor from `actorId`; never from a body field inside the use case
- [ ] Reconstitute with snapshot `username` and `removedAt`
- [ ] Policy before any mutator / persist
- [ ] Occupancy skipped when email omitted or equal after `Email.create`
- [ ] `EmployeePoliciesService.ensureEmailIsAvailable` signature unchanged
- [ ] Persist payload has only present normalized keys
- [ ] Never `changePhone(null)`; never `toJSON()` as the write
- [ ] Co-located spec covers the table
- [ ] No controller / route / `AGENT.md` in this slice

## Out of scope

- HTTP presence of `status` / `password` (controller)
- `requireRoles`
- JWT revoke after email change
- Get-by-id query

## Acceptance criteria

- [ ] `{ name }` only → persist `{ name }`; occupancy not called
- [ ] Same email as Target (different case) → occupancy not called; persist normalized email if the key was present
- [ ] New free email → occupancy called; persist
- [ ] New email held by `ACTIVE` → `EmployeeAlreadyExistsError`; no persist
- [ ] New email held by `INACTIVE` → `EmployeeInactiveError`; no persist
- [ ] `{ username: "" }` → `changeUsername(null)` + persist `{ username: null }`
- [ ] Blank actorId / Actor miss → `ActorAuthenticationFailedError` before Target load when possible
- [ ] Target miss → `EmployeeNotFoundError`
- [ ] Never `changePhone(null)`
- [ ] Use-case spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Sibling command flow | `application/usecases/update-employee-status.usecase.ts` |
| Occupancy (do not change signature) | `domain/services/employee-policies.service.ts` |
| Policy | `domain/services/employee-main-data.policy.ts` |
| Persist port | `application/ports/outbound/update-main-employee-data-repository.port.ts` |
| Next slice | [`03-http-and-contract.md`](./03-http-and-contract.md) |
