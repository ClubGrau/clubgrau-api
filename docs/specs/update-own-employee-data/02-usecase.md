# Spec: Slice 2 — `UpdateOwnEmployeeDataUsecase`

> Application command: Actor load, policy, resolver, patch service, one `$set`, re-read.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), [`01-persistence.md`](./01-persistence.md).  
> Design §8.1–§8.3.  
> Jira: TBD.  
> Next: [`04-http-and-contract.md`](./04-http-and-contract.md). The query ([`03-query.md`](./03-query.md)) does not wait on this slice.

## Responsibility (this spec only)

Orchestrate Update Own Employee Data behind an inbound port. The use case loads the Actor, checks login-capable status, drops `undefined` keys, asks the own patch service to validate and mutate, persists the returned patch with one `updateOwnData`, then re-reads `GetEmployeesItemDto`. It returns that read model. It does not return `{ id }`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Policy + patch service |
| [`01`](./01-persistence.md) | `updateOwnData` + `findOwnEmployee` |
| **This file** | DTO + inbound port + resolver + use case + spec |
| [`03`](./03-query.md) | Get Own Employee (independent) |
| [`04`](./04-http-and-contract.md) | Controller / route / `AGENT.md` |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `UpdateOwnEmployeeDataDto` | Yes |
| Inbound `UpdateOwnEmployeeDataPort` | Yes — `execute` returns `GetEmployeesItemDto` |
| `resolveOwnEmployeeDataChanges` | Yes |
| `UpdateOwnEmployeeDataUsecase` + spec | Yes |
| Controller / route / query / module wiring | **No** |
| `AGENT.md` living contract | **No** — slice 4 |
| `EmployeeSnapshotMapper` | **No** — it already forwards the fields this command reconstitutes. Do not change it |
| Encrypter / occupancy / operator policies / `EmployeeMainDataPatchService` | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Update Own Employee Data following [`docs/specs/update-own-employee-data/02-usecase.md`](./02-usecase.md).  
> Policy, then resolver, then patch, then one `$set`, then re-read. Return `GetEmployeesItemDto`.  
> Never `Employee.create`. Do not return `{ id }`. Re-read `null` is unexpected `500`, not `401`. Invalid `nif` together with `name` does not call `updateOwnData`. Do not add the controller, the route, or the query.

## Application contracts

### DTO — `application/dtos/update-own-employee-data.dto.ts`

```ts
interface UpdateOwnEmployeeDataDto {
  actorId: string
  name?: string
  phone?: string
  username?: string | null
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | null
  address?: string | null
}
```

The inbound DTO contains only keys the controller decided were present, plus `actorId`. It has no `id`, no `email`, no `password`. `null` is present. There is no result DTO: the command result **is** `GetEmployeesItemDto`.

A class with a constructor is fine if it matches `UpdateMainEmployeeDataDto`. Do not trim inside the DTO. Do not `Number()` the `nif`.

### Inbound port — `application/ports/inbound/update-own-employee-data.port.ts`

```ts
interface UpdateOwnEmployeeDataPort {
  execute(params: UpdateOwnEmployeeDataDto): Promise<GetEmployeesItemDto>
}
```

### Resolver — `application/services/own-employee-data-changes.resolver.ts`

```ts
function resolveOwnEmployeeDataChanges(
  fields: Partial<Record<OwnEmployeeDataField, string | null | undefined>>,
): OwnEmployeeDataChanges
```

Strip entries whose value is `undefined`. If none of the eight keys remain, throw `EmptyOwnEmployeeDataError`. `null` stays. Do not validate name, phone, gender, or NIF here. Do not call `resolveMainEmployeeDataChanges` or `resolvePersonalEmployeeDataChanges`.

## Use case flow (normative)

Constructor:

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  ownDataPolicy: EmployeeOwnDataPolicy,
  ownDataPatchService: EmployeeOwnDataPatchService,
  updateOwnDataRepository: UpdateOwnEmployeeDataRepositoryPort,
  findOwnEmployee: FindOwnEmployeePort,
)
```

The module (slice 4) injects the same repository as `findById`, `updateOwnData`, and `findOwnEmployee`. Do not construct adapters here. Do not inject `EmployeeMainDataPatchService`, an occupancy port, or an operator policy.

```text
execute(dto)
  1. actorId empty or blank → ActorAuthenticationFailedError
  2. findById(actorId) — miss → ActorAuthenticationFailedError
       not EmployeeNotFoundError
  3. EmployeeSnapshotMapper.toEntity
       which calls Employee.reconstitute
       Password.fromHash
       never Employee.create
       do not change the mapper
  4. ownDataPolicy.assertCan(actor.status)
  5. resolveOwnEmployeeDataChanges(the eight writable fields from the dto)
       throws EmptyOwnEmployeeDataError when every writable key is undefined
  6. ownDataPatchService.apply(actor, changes)   // sync
  7. updateOwnData({ id: actorId, ...patch })
       nif on this object is still a string or null
  8. findOwnEmployee(actorId)
       null → throw a non-domain Error (unexpected, 500)
       this is not ActorAuthenticationFailedError
       the Actor was just found
  9. return that GetEmployeesItemDto
```

Order is the contract: policy, then resolver, then patch, then one `$set`, then re-read.

If steps 1–6 throw, **do not** call `updateOwnData` and **do not** call `findOwnEmployee`. Step 8 runs only after a successful `$set`.

There is no second id. Do not load a Target. Do not call `updateMainData` or `updatePersonalData`. No encrypter. No occupancy.

A direct `execute` with every writable field `undefined` still throws `EmptyOwnEmployeeDataError`, and only after the Actor check (steps 1–4). HTTP `{}` never reaches `execute`; that `400` is the controller in slice 4.

`{ name, nif: invalid }` fails inside `apply`. `updateOwnData` is not called, so the name is not persisted.

Re-read `null` after a successful `$set` throws unexpected. Do not map it to `401`.

Do not persist `employee.toJSON()`.

## Files

| File | Action |
|------|--------|
| `application/dtos/update-own-employee-data.dto.ts` | Create |
| `application/ports/inbound/update-own-employee-data.port.ts` | Create |
| `application/services/own-employee-data-changes.resolver.ts` | Create (+ spec if the strip/`Empty` rule is not fully covered by the use-case spec) |
| `application/usecases/update-own-employee-data.usecase.ts` + `*.spec.ts` | Create |
| Controller / routes / query / `employees.module.ts` / `AGENT.md` / `.http` / snapshot mapper | Do not change |

## Spec expectations (`update-own-employee-data.usecase.spec.ts`)

`makeStubs` / `makeSut` / `SutTypes`. Stub `FindEmployeeByIdPort`, `EmployeeOwnDataPolicy` (`assertCan: jest.fn()`), `UpdateOwnEmployeeDataRepositoryPort`, and `FindOwnEmployeePort`. Use a real `EmployeeOwnDataPatchService` wrapping a real `EmployeePersonalDataPatchService` so name / phone / gender / NIF failures are the domain ones. Stub `apply` only when the case is about propagating a policy error before the patch.

Default snapshot: Actor `EMPLOYEE` (or any role) `ACTIVE`, with name, phone, username, email, and personal fields filled, so a one-field persist can prove the other keys were not sent. `findOwnEmployee` resolves a `GetEmployeesItemDto` built from that same identity (no `password` property). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdateOwnEmployeeDataUsecase` |
| missing / blank `actorId` | `ActorAuthenticationFailedError`; `findById` not called; no persist; no re-read |
| Actor `findById` null | `ActorAuthenticationFailedError`; no persist; no re-read |
| `findById` called with `actorId` only | one call; no second id |
| `assertCan` called with `actor.status` before persist | |
| `assertCan` throws `ActorAuthenticationFailedError` | propagate; `apply` not called; no persist; no re-read |
| Actor `VACATION` (policy real or stub allows) | persist is reached |
| `{ phone: '+351 912 345 678' }` only | `updateOwnData` `{ id: actorId, phone }` equals the normalized phone; no `name` / `email` / `username` / personal keys |
| `{ name: 'Ana Silva' }` only | persist `{ id, name }` normalized; email not in the payload |
| `{ username: null }` | persist `{ id, username: null }` |
| `{ username: '  joao  ' }` | persist `{ id, username: 'joao' }` |
| `{ nif: null }` | persist `{ id, nif: null }` (not a number) |
| `{ nif: '123456789' }` | persist `{ id, nif: '123456789' }` (string) |
| `{ gender: 'male' }` | persist `{ id, gender: 'male' }` |
| `{ gender: 'invalid' }` | `InvalidEmployeeGenderError`; no persist; no re-read |
| `{ name: 'Ana Silva', nif: '00000000' }` | `InvalidNifError`; `updateOwnData` not called |
| `{ address: 'Rua B' }` only | persist `{ id, address: 'Rua B' }`; not `EmptyMainEmployeeDataError` |
| all eight keys | persist all eight; `nif` still a string; no `email` |
| every writable field `undefined` | `EmptyOwnEmployeeDataError` after `findById` and `assertCan`; no persist |
| `Password.fromHash` on load | spy; `Password.create` not used; `Employee.create` not used |
| phone-only persist does not send the snapshot's other fields | payload has no `name` / `username` / `gender` / `nif` / `address` |
| success return value | the object `findOwnEmployee` resolved; not `{ id }` |
| `findOwnEmployee` called with `actorId` only after `updateOwnData` resolves | order |
| `findOwnEmployee` returns `null` after a successful `$set` | throws a non-domain `Error`; not `ActorAuthenticationFailedError` |
| no Encrypter / occupancy / main patch service / operator policy deps | constructor arity is the five collaborators above |
| returned read model has no `password` | |

## Checklist (agent)

- [ ] Actor from `actorId`; the DTO has no `id` and no `email`
- [ ] Reconstitute via the existing snapshot mapper; do not edit the mapper
- [ ] Never `Employee.create`
- [ ] Policy, then resolver, then patch, then one `$set`, then re-read
- [ ] Resolver throws `EmptyOwnEmployeeDataError` when no writable key is defined, and only after the Actor check
- [ ] Resolver does not call the Main or Personal resolvers
- [ ] `apply` stays synchronous at the call site
- [ ] Invalid `nif` with a valid `name` does not call `updateOwnData`
- [ ] Persist payload is the patch (present normalized keys only); `nif` is a string or `null`
- [ ] Success returns `GetEmployeesItemDto` from `findOwnEmployee`, not `{ id }`
- [ ] Re-read `null` is unexpected, not `401`
- [ ] No occupancy; no `updateMainData`; no `updatePersonalData`
- [ ] Co-located spec covers the table
- [ ] No controller / route / query / `AGENT.md` in this slice

## Out of scope

- HTTP presence, `nif` number → string, blank `name` / `phone` → `InvalidParamError` (controller)
- `GET /employee/me`
- `requireRoles`
- Session Token reissue (slice 5; this use case still returns only `GetEmployeesItemDto`)
- Prerequisite Main username controller fix

## Acceptance criteria

- [ ] `{ phone }` → persist that phone only; email unchanged in the payload
- [ ] `{ username: null }` → persist `{ username: null }`
- [ ] `{ name, nif: invalid }` → `InvalidNifError`; `updateOwnData` not called
- [ ] `{ address }` only → persists address; not an empty-main error
- [ ] No writable keys → `EmptyOwnEmployeeDataError` after the Actor check; no persist
- [ ] Blank `actorId` / Actor miss / not login-capable → `ActorAuthenticationFailedError`; no persist
- [ ] Success body is the re-read `GetEmployeesItemDto` (no `password`)
- [ ] Re-read `null` throws unexpected after the `$set`
- [ ] Use-case spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Sibling command flow | `application/usecases/update-personal-employee-data.usecase.ts` |
| Resolver to mirror (do not call) | `application/services/personal-employee-data-changes.resolver.ts` |
| Reconstitute (do not edit) | `application/mappers/employee-snapshot.mapper.ts` |
| Policy | `domain/services/employee-own-data.policy.ts` |
| Patch service | `domain/services/employee-own-data-patch.service.ts` |
| Write port | `application/ports/outbound/update-own-employee-data-repository.port.ts` |
| Read port | `application/ports/outbound/find-own-employee.port.ts` |
| Read model | `GetEmployeesItemDto` in `application/dtos/get-employees.dto.ts` |
| Next HTTP slice | [`04-http-and-contract.md`](./04-http-and-contract.md) |
