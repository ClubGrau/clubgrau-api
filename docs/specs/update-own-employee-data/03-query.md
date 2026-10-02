# Spec: Slice 3 — `GetOwnEmployeeQuery`

> Application query: own read model + login-capable status.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), the read port from [`01-persistence.md`](./01-persistence.md). Does **not** depend on [`02-usecase.md`](./02-usecase.md).  
> Design §8.4.  
> Jira: TBD.  
> Next: [`04-http-and-contract.md`](./04-http-and-contract.md).

## Responsibility (this spec only)

Return the Actor's collaborator as `GetEmployeesItemDto`. The only rule is login-capable status, and the read model already carries `status`, so this query calls `EmployeeOwnDataPolicy` and does not reconstitute an `Employee`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | `EmployeeOwnDataPolicy.assertCan(status)` |
| [`01`](./01-persistence.md) | `FindOwnEmployeePort.findOwnEmployee` |
| **This file** | Inbound port + `GetOwnEmployeeQuery` + spec |
| [`02`](./02-usecase.md) | Write path — not used here |
| [`04`](./04-http-and-contract.md) | `GET /employee/me` |

## When to use this spec

Queries in this hexagon do not call operator policies, `Employee.create`, or the encrypter. This query is the exception that calls `EmployeeOwnDataPolicy`, because the rule is status only.

| Artifact | This slice? |
|----------|-------------|
| `GetOwnEmployeePort` | Yes |
| `GetOwnEmployeeQuery` + spec | Yes |
| Controller / route / module | **No** |
| `FindEmployeeByIdPort` / `Employee.reconstitute` / snapshot mapper | **No** |
| `updateOwnData` | **No** |
| A new read-model type | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of Update Own Employee Data following [`docs/specs/update-own-employee-data/03-query.md`](./03-query.md).  
> `GetOwnEmployeeQuery` loads `findOwnEmployee` and calls `EmployeeOwnDataPolicy.assertCan(status)`. Miss and not-login-capable → `ActorAuthenticationFailedError`.  
> Do not call `findById`. Do not reconstitute. Do not return `password`. Do not add the controller or the route.

## Application contracts

### Inbound port — `application/ports/inbound/get-own-employee.port.ts`

```ts
interface GetOwnEmployeePort {
  execute(params: { actorId: string }): Promise<GetEmployeesItemDto>
}
```

No filter DTO. No pagination. No path id.

### Query — `application/queries/get-own-employee.query.ts`

Constructor:

```ts
constructor(
  findOwnEmployee: FindOwnEmployeePort,
  ownDataPolicy: EmployeeOwnDataPolicy,
)
```

```text
execute({ actorId })
  1. actorId empty or blank → ActorAuthenticationFailedError
  2. findOwnEmployee(actorId) — null → ActorAuthenticationFailedError
       not EmployeeNotFoundError
  3. ownDataPolicy.assertCan(readModel.status)
       INACTIVE / REMOVED → ActorAuthenticationFailedError
  4. return the read model
```

Do not call `FindEmployeeByIdPort`. Do not call `Employee.reconstitute` or `Employee.create`. Do not require a previous PATCH. Do not filter status in the query before the policy: a non-null `INACTIVE` or `REMOVED` read model must reach `assertCan` so the refusal is the policy's.

There is no Target. Do not throw `EmployeeAlreadyRemovedError`.

## Files

| File | Action |
|------|--------|
| `application/ports/inbound/get-own-employee.port.ts` | Create |
| `application/queries/get-own-employee.query.ts` + `*.spec.ts` | Create |
| Controller / routes / `employees.module.ts` / `AGENT.md` / use case | Do not change |

## Spec expectations (`get-own-employee.query.spec.ts`)

`makeStubs` / `makeSut`. Stub `FindOwnEmployeePort`. Use a real `EmployeeOwnDataPolicy` so status refusals are the domain ones. Default read model: `EMPLOYEE`, `ACTIVE`, personal and main fields filled, **no** `password` key. `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `GetOwnEmployeeQuery` |
| missing / blank `actorId` | `ActorAuthenticationFailedError`; `findOwnEmployee` not called |
| `findOwnEmployee` null | `ActorAuthenticationFailedError`; `assertCan` not called |
| `findOwnEmployee` called with `actorId` | |
| `ACTIVE` | returns the same read model; `assertCan` saw `ACTIVE` |
| `VACATION` | returns the read model |
| `INACTIVE` | `ActorAuthenticationFailedError`; nothing returned |
| `REMOVED` | `ActorAuthenticationFailedError`; not `EmployeeAlreadyRemovedError` |
| returned object | `'password' in result` is false; shape is the stubbed `GetEmployeesItemDto` |
| role is not consulted | `EMPLOYEE`, `MANAGER`, and `ADMIN` with `ACTIVE` all return |
| constructor | `FindOwnEmployeePort` + `EmployeeOwnDataPolicy` only; no `FindEmployeeByIdPort` |

## Checklist (agent)

- [ ] Blank `actorId` → `401` class before the read
- [ ] Miss → `ActorAuthenticationFailedError`, not `EmployeeNotFoundError`
- [ ] `assertCan(readModel.status)` after a hit
- [ ] `INACTIVE` and `REMOVED` → `ActorAuthenticationFailedError`
- [ ] `ACTIVE` and `VACATION` return the read model for any role
- [ ] No `findById`, no reconstitute, no `password`
- [ ] No new read-model type
- [ ] Co-located spec covers the table
- [ ] No controller / route / `AGENT.md` / use case edits

## Out of scope

- `GET` route and controller (slice 4)
- PATCH / `updateOwnData`
- Get employee by id of another collaborator
- List query changes
- Session Token contents

## Acceptance criteria

- [ ] Login-capable Actor → the `GetEmployeesItemDto` from `findOwnEmployee`, no `password`
- [ ] `MANAGER` and `ADMIN` get that same self read model, not a list
- [ ] Missing Actor → `ActorAuthenticationFailedError`
- [ ] `INACTIVE` or `REMOVED` → `ActorAuthenticationFailedError`; the read model is not returned
- [ ] Query spec passes
- [ ] Query does not import the use case

## Reference map

| Concern | Look at |
|---------|---------|
| List query (do not copy its filters) | `application/queries/get-employees.query.ts` |
| Policy | `domain/services/employee-own-data.policy.ts` |
| Read port | `application/ports/outbound/find-own-employee.port.ts` |
| Read model | `GetEmployeesItemDto` |
| Next slice | [`04-http-and-contract.md`](./04-http-and-contract.md) |
