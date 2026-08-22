# Spec: Slice 3 — Tighten `UpdateEmployeeStatus` (actor + policy + HTTP map)

> Existing command becomes the operational half of the lifecycle matrix.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00`](./00-adapt-route-and-http-helpers.md) (`actorId`, `forbidden`, `conflict`), [`01`](./01-domain.md) (policy), [`02`](./02-persistence.md) (count port on the repo).  
> Design §8.1 / §9 / [ADR 0010](../../adr/remove-or-inactivate-emp/0010-lifecycle-policy-is-a-domain-service.md) / [ADR 0012](../../adr/remove-or-inactivate-emp/0012-lifecycle-http-status-mapping.md).  
> Next: [`04-remove-employee.md`](./04-remove-employee.md).

## Responsibility (this spec only)

`POST /api/employee/update-status` identifies the Actor from the JWT, runs `EmployeeLifecyclePolicy`, and maps domain errors to `400` / `401` / `403` / `409`. It still does **not** Remove.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-adapt-route-and-http-helpers.md) | Adapter already stamps `actorId` |
| [`01`](./01-domain.md) | Policy + errors exist |
| **This file** | DTO `actorId`, use case flow, controller validation + HTTP map, module wiring of the policy |
| [`04`](./04-remove-employee.md) | New Remove command |
| Auth | Session after INACTIVE — **not** this command |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `UpdateEmployeeStatusDto.actorId` | Yes |
| Use case: load Actor + Target, `assertCan`, then existing transition | Yes |
| Controller: `isOperationalStatus`; forward `actorId`; map `401`/`403`/`409` | Yes |
| `makeEmployeesModule` constructs `EmployeeLifecyclePolicy(repository)` and injects it | Yes |
| `app.ts` / `adaptRoute` / schema | **No** (already done) |
| Remove route / step-up password | **No** |
| List `isOperationalStatus` | **No** — slice 5 |
| Encrypter / email policy | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of employee lifecycle following [`docs/specs/employee-lifecycle/03-update-employee-status.md`](./03-update-employee-status.md).  
> Add `actorId` to the update-status DTO. Load Actor and Target, call `EmployeeLifecyclePolicy.assertCan`, then keep the existing transition + `$set`.  
> Controller: `isOperationalStatus` (reject `REMOVED` with `400`); map lifecycle errors to `401`/`403`/`409`.  
> Wire the policy in `makeEmployeesModule`. Do not add Remove.

## Application contracts

### DTO — `application/dtos/update-employee-status.dto.ts`

```ts
interface UpdateEmployeeStatusDto {
  actorId: string
  id: string
  status: EmployeeModel.OperationalStatus  // not REMOVED
}

interface UpdateEmployeeStatusResultDto {
  id: string
  status: EmployeeModel.Status  // operational after a successful transition
}
```

If `OperationalStatus` is not exported yet, export it from `EmployeeModel` (slice 1). Do not type `status` as the full enum.

Inbound port `execute` signature follows the DTO — no new inbound port.

### HTTP request — `presentation/http/update-employee-status.request.ts`

```ts
export type UpdateEmployeeStatusRequest = {
  id?: string
  status?: string
  actorId?: string  // from adaptRoute; never trusted from the client
}
```

## Use case flow (normative)

`UpdateEmployeeStatusUsecase` constructor:

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  updateEmployeeStatusRepository: UpdateEmployeeStatusRepositoryPort,
  lifecyclePolicy: EmployeeLifecyclePolicy,
)
```

No encrypter. No email policy. No `CompareHashPort`.

```text
execute({ actorId, id, status })
  1. if actorId is missing/blank → throw ActorAuthenticationFailedError
  2. actorSnapshot = findById(actorId); null → ActorAuthenticationFailedError
  3. targetSnapshot = findById(id);     null → EmployeeNotFoundError
  4. reconstitute both (Password.fromHash; removedAt: snapshot.removedAt ?? null)
  5. intent = map status → LifecycleIntent
        ACTIVE   → REACTIVATE
        INACTIVE → DEACTIVATE
        VACATION → VACATION
  6. await lifecyclePolicy.assertCan({ actor, target, intent })
  7. activate | deactivate | putOnVacation  (unchanged already-in-status errors)
  8. updateStatus({ id, status, deactivateAt })  // $set those two only
  9. return { id, status }
```

If steps 1–7 throw, **do not** call `updateStatus`.

Load Actor **before** Target. Actor miss is `401`, not `EmployeeNotFoundError` (do not leak whether the JWT id still exists).

`findById` is called twice (two ids). Specs must assert both calls.

Map `REMOVED` must be impossible after the controller; if it reached the use case, keep throwing `InvalidEmployeeStatusError` (slice 1 seam).

Reconstitute must pass `removedAt`. Do not call `Employee.create`.

## Controller (normative)

Still Express-free. Inject inbound port only.

1. Required fields: `id`, `status` → `400` + `MissingParamError`. Do **not** require `actorId` as a missing-param (that would leak the field name to clients).
2. Status via `EmployeeModel.isOperationalStatus` (not `isStatus`). `REMOVED` / `'active'` / `'ROOT'` → `400` + `InvalidParamError('status')`. Do not call the port.
3. Forward `{ actorId: String(request.actorId ?? ''), id: String(id), status }` into the port. Empty `actorId` is the use case’s `401` path.
4. Success → `ok({ id, status })` (`200`).
5. `catch` map:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmployeeLifecycleForbiddenError` | `forbidden` (`403`) |
| `LastAdminProtectedError` | `conflict` (`409`) |
| `EmployeeAlreadyRemovedError` | `conflict` (`409`) |
| `EmployeeNotFoundError` | `badRequest` (`400`) — unchanged |
| `EmployeeAlreadyActiveError` / `EmployeeAlreadyInactiveError` / `EmployeeAlreadyOnVacationError` | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

`EmployeeNotInactiveError` is a Remove-only conflict; update-status should not throw it. If it appears, `serverError` is acceptable — do not special-case it unless you share a mapper.

Replace `it.each(Object.values(EmployeeModel.Status))` with `EmployeeModel.OPERATIONAL_STATUSES`. Add an explicit `REMOVED` → `400` case.

Do not put `:id` on the path. Do not document `actorId` in `.http`.

## Module factory

```ts
const lifecyclePolicy = new EmployeeLifecyclePolicy(employeeRepository)

const updateEmployeeStatus = new UpdateEmployeeStatusUsecase(
  employeeRepository,
  employeeRepository,
  lifecyclePolicy,
)
```

`makeEmployeesModule` deps stay `{ connection, encrypter, authTokenMiddleware }` in this slice (`compareHash` arrives in slice 4).

`app.ts` unchanged.

## `.http` / `AGENT.md`

- `.http`: no `actorId` in the body. Optional comment that the Actor comes from the Bearer token.
- `AGENT.md`: update-status flow now includes Actor load + policy; HTTP error table for this command (`400`/`401`/`403`/`409`). Do **not** mark Remove as shipped. Slice 5 is the full living-contract pass — a minimal honest update here is enough.

## Files

| File | Action |
|------|--------|
| `application/dtos/update-employee-status.dto.ts` | Add `actorId`; operational status |
| `application/usecases/update-employee-status.usecase.ts` + `*.spec.ts` | Actor + policy |
| `presentation/http/update-employee-status.request.ts` | Optional `actorId` |
| `presentation/controllers/update-employee-status.controller.ts` + `*.spec.ts` | Guard + HTTP map |
| `employees.module.ts` | Construct + inject policy |
| `src/modules/employees/AGENT.md` | Command flow + HTTP codes for update-status |
| `src/client/employee.http` | Comment only; no `actorId` |
| Remove / list controller / schema | Do not change |

## Spec expectations

### `update-employee-status.usecase.spec.ts`

Stub `FindEmployeeByIdPort`, `UpdateEmployeeStatusRepositoryPort`, and `EmployeeLifecyclePolicy` (`assertCan: jest.fn().mockResolvedValue(undefined)`). Default snapshots: Actor ADMIN ACTIVE (different id), Target EMPLOYEE ACTIVE.

`findById` must dispatch by id (Actor vs Target). Implementation tip: `mockImplementation(async (id) => …)`.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance |
| missing `actorId` | `ActorAuthenticationFailedError`; no `updateStatus` |
| Actor `findById` null | `ActorAuthenticationFailedError`; no `updateStatus` |
| Target `findById` null | `EmployeeNotFoundError`; no `updateStatus` |
| `should call findById with actorId then target id` | both ids |
| `should map INACTIVE to DEACTIVATE and call assertCan` | intent `DEACTIVATE` |
| `should map ACTIVE to REACTIVATE` | intent `REACTIVATE` |
| `should map VACATION to VACATION` | intent `VACATION` |
| `assertCan` throw forbidden | propagate; no `updateStatus` |
| `assertCan` throw Last Admin | propagate; no `updateStatus` |
| `assertCan` throw actor-auth | propagate; no `updateStatus` |
| successful DEACTIVATE still `$set` INACTIVE + `deactivateAt` Date | same persist contract as today |
| already-in-status errors | no `updateStatus` |
| Password.fromHash on load | spy; `Password.create` not used |
| no Encrypter / email policy deps | constructor arity / absence |

Keep the existing transition table (ACTIVE↔INACTIVE↔VACATION) — policy stub allows them.

### `update-employee-status.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| missing `id` / `status` | `400`; port not called |
| `status: 'REMOVED'` | `400` `Invalid param status`; port not called |
| `status: 'active'` | `400`; port not called |
| `it.each(OPERATIONAL_STATUSES)` | port called with that status + `actorId` |
| forwards `actorId` from request | `{ actorId, id, status }` |
| `ActorAuthenticationFailedError` | `401` + `{ error: 'Authentication failed' }` |
| `EmployeeLifecycleForbiddenError` | `403` |
| `LastAdminProtectedError` | `409` |
| `EmployeeAlreadyRemovedError` | `409` |
| `EmployeeNotFoundError` / already-in-status (all three) | `400` |
| generic throw | `500` |
| success | `200` `{ data: { id, status } }` |

Do not test Express middleware here.

## Checklist (agent)

- [ ] Body cannot choose the Actor; `actorId` comes from the request object stamped by `adaptRoute`
- [ ] Actor miss / blank → `ActorAuthenticationFailedError` (`401`)
- [ ] Policy runs before any transition write
- [ ] Persist still `$set` `status` + `deactivateAt` only
- [ ] `REMOVED` payload → `400` at the controller
- [ ] HTTP map matches the table
- [ ] Module injects `EmployeeLifecyclePolicy`
- [ ] Co-located specs pass
- [ ] No Remove route; no `compareHash` on the module yet

## Out of scope

- `POST /api/employee/remove`
- List filter `isOperationalStatus`
- JWT blacklist / auth re-check
- Create-employee authorization

## Acceptance criteria

- [ ] MANAGER + Target EMPLOYEE + `{ status: INACTIVE }` → policy `DEACTIVATE` → `200` (when policy allows)
- [ ] MANAGER + Target ADMIN → `403`; no write
- [ ] EMPLOYEE Actor any update-status → `403`; no write
- [ ] Last Admin `{ status: INACTIVE }` or `VACATION` → `409`; no write
- [ ] `{ status: "REMOVED" }` → `400`
- [ ] Body `{ actorId: "forged" }` is overwritten by JWT (adapter already); use case sees JWT id
- [ ] Use-case + controller specs pass

## Reference map

| Concern | Look at |
|---------|---------|
| Use case today | `application/usecases/update-employee-status.usecase.ts` |
| Controller today | `presentation/controllers/update-employee-status.controller.ts` |
| Policy | `domain/services/employee-lifecycle.policy.ts` |
| HTTP helpers | `@shared/presentation/helpers/http-helper` |
| Previous HTTP spec (superseded mapping) | [`docs/specs/update-employee-status/`](../update-employee-status/) |
| Next slice | [`04-remove-employee.md`](./04-remove-employee.md) |
