# Spec: Update Employee Status — Use case

> Implementation contract for **persisting the status transition**.  
> Feature folder: [`docs/specs/update-employee-status/`](./).  
> Sibling HTTP slice (already delivered): [`controller.md`](./controller.md).  
> Global rules: [`AGENTS.md`](../../../AGENTS.md).  
> Module contract: [`src/modules/employees/AGENT.md`](../../../src/modules/employees/AGENT.md).  
> Canonical mirrors: [`CreateEmployeeUsecase`](../../../src/modules/employees/application/usecases/create-employee.usecase.ts), [`Employee`](../../../src/modules/employees/domain/entities/Employee.ts) (`activate` / `deactivate` / `putOnVacation`).

## Responsibility (this spec only)

**Persist the transition.** Load the employee, apply the domain status change, write `status` + `deactivateAt`.

| Spec | Responsibility |
|------|----------------|
| [`controller.md`](./controller.md) | HTTP validation, route, composition up to `makeApp` |
| **This file** | Orchestrate + persist the status transition |
| Auth (not written) | Whether an existing JWT may still call the API |
| Front (not this repo) | Interceptor `401` → clear token → login |

**Out of scope: session.** This command does not decode JWTs, revoke tokens, touch `authTokenMiddleware`, or decide if a logged-in employee stays authenticated. Inactivating a collaborator **only** updates the document. Session impact is an auth-hexagon concern.

## When to use this spec

Use this document to implement `UpdateEmployeeStatusUsecase`, its outbound ports, the repository methods that persist the transition, and to **replace** the temporary inbound-port stub in `employees.module.ts`.

DTOs and `UpdateEmployeeStatusPort` **already exist** from the controller slice — reuse them. Do not recreate them. Do not change the HTTP controller.

| Artifact | This slice? |
|----------|-------------|
| `UpdateEmployeeStatusUsecase` + `*.usecase.spec.ts` | Yes |
| Outbound ports `findById` + `updateStatus` | Yes |
| Repository + mapper support for those ports + repository spec cases | Yes |
| Replace temporary port in `makeEmployeesModule` | Yes |
| Employees `AGENT.md` (command contract + wiring) | Yes |
| HTTP controller / routes / `app.ts` / `.http` | **No** — [`controller.md`](./controller.md) |
| Schema fields `status` / `deactivateAt` | **No** — already on the schema |
| Entity `activate` / `deactivate` / `putOnVacation` | **No** — already on `Employee`; call them, do not reimplement |
| Encrypter / email policies / create / list | **No** |
| Session / JWT / `authTokenMiddleware` / login | **No** |
| HTTP mapping of domain errors to `404`/`409` | **No** — controller still uses `serverError` |

**Prompt sketch for the agent:**

> Implement `UpdateEmployeeStatusUsecase` following [`docs/specs/update-employee-status/usecase.md`](./usecase.md).  
> Implement `UpdateEmployeeStatusPort`. Load by id, `Employee.reconstitute`, call `activate` / `deactivate` / `putOnVacation`, persist only `status` + `deactivateAt`.  
> Replace the temporary port in `makeEmployeesModule`.  
> Do not change the controller. Do not touch auth or session.

## Application contracts (already exist — consume)

```ts
interface UpdateEmployeeStatusDto {
  id: string;
  status: EmployeeModel.Status;
}

interface UpdateEmployeeStatusResultDto {
  id: string;
  status: EmployeeModel.Status;
}

interface UpdateEmployeeStatusPort {
  execute(params: UpdateEmployeeStatusDto): Promise<UpdateEmployeeStatusResultDto>;
}
```

The controller already guarantees `id` / `status` present and `status` ∈ enum. The use case **does not** re-validate HTTP presence or enum spelling. It **does** reject “already in this status” via the entity.

Return **only** `{ id, status }` after the transition. No password, no list read model, no `toCreate` as HTTP/output.

## Outbound ports (this slice adds)

Keep them on the **application** outbound side (the use case needs them; no domain service does). `EmployeeMongooseRepository` implements both, same pattern as create + findByEmail.

### `application/ports/outbound/find-employee-by-id.port.ts`

```ts
interface FindEmployeeByIdPort {
  findById(id: string): Promise<EmployeeModel.toCreate | null>;
}
```

- Snapshot via existing `mapEmployeeDocument` (includes the **real password hash**).
- Missing document → `null`.
- Malformed id (not a 24-char hex ObjectId) → `null` (do **not** leak Mongoose `CastError`). The use case maps `null` to `EmployeeNotFoundError`.

### `application/ports/outbound/update-employee-status-repository.port.ts`

```ts
interface UpdateEmployeeStatusParams {
  id: string;
  status: EmployeeModel.Status;
  deactivateAt: Date | null;
}

interface UpdateEmployeeStatusRepositoryPort {
  updateStatus(params: UpdateEmployeeStatusParams): Promise<void>;
}
```

Persist with `$set` of **`status` and `deactivateAt` only**. Do not write name, email, role, phone, nif, password, or `createdAt`.

### Why not `employee.toJSON()` as a full write

`Password.toJSON()` returns `'[REDACTED]'`. A full-document save from `toJSON()` would overwrite the hash. This command must never persist the redacted password. Partial `$set` is mandatory.

## Use case flow (normative)

`UpdateEmployeeStatusUsecase` implements `UpdateEmployeeStatusPort`.

Constructor injects `FindEmployeeByIdPort` + `UpdateEmployeeStatusRepositoryPort` only. No encrypter, no policies, no Express, no Mongoose types.

```text
execute({ id, status })
  1. snapshot = findById(id)
  2. if snapshot is null → throw EmployeeNotFoundError
  3. employee = Employee.reconstitute(from snapshot VOs)
  4. apply transition for `status` (see table) — entity throws if already in that status
  5. updateStatus({ id: employee.id, status: employee.status, deactivateAt })
  6. return { id: employee.id, status: employee.status }
```

If step 4 throws, **do not** call `updateStatus`.

### Reconstitute from snapshot

Application may import domain VOs. Map `EmployeeModel.toCreate` → `ReconstituteEmployeeProps`:

| Snapshot field | Reconstitute with |
|----------------|-------------------|
| `id` | as-is |
| `name` | `Name.create` |
| `email` | `Email.create` |
| `password` | `Password.fromHash` (hash from DB — **never** `Password.create`) |
| `phone` | `Phone.create` when non-null, else `null` |
| `nif` | `Nif.create` when non-null, else `null` |
| `role` / `status` / `createdAt` / `deactivateAt` | as-is |

Do not call `Employee.create` (that would force `ACTIVE` and treat password as plaintext).

`deactivateAt` after the transition: `employee.toJSON().deactivateAt` (Date or `null`). Using `toJSON()` **only** to read `status` / `deactivateAt` is fine; do not pass the whole JSON to the repository.

### Status → entity method

| Requested `status` | Method | After |
|--------------------|--------|--------|
| `INACTIVE` | `deactivate()` | `status = INACTIVE`, `deactivateAt = now` |
| `ACTIVE` | `activate()` | `status = ACTIVE`, `deactivateAt = null` |
| `VACATION` | `putOnVacation()` | `status = VACATION`, `deactivateAt = null` |

Exhaustive `switch`. Unknown value (should not happen after the controller) → `InvalidEmployeeStatusError`. Do **not** assign `employee.props.status` in the use case.

Any transition between the three statuses is allowed **except** requesting the current one (entity already throws):

| From → To | Result |
|-----------|--------|
| `ACTIVE` → `INACTIVE` | persist |
| `ACTIVE` → `VACATION` | persist |
| `INACTIVE` → `ACTIVE` | persist (reactivation of this employee) |
| `INACTIVE` → `VACATION` | persist (`deactivateAt` cleared) |
| `VACATION` → `ACTIVE` | persist |
| `VACATION` → `INACTIVE` | persist (`deactivateAt` set) |
| `ACTIVE` → `ACTIVE` | `EmployeeAlreadyActiveError`; no write |
| `INACTIVE` → `INACTIVE` | `EmployeeAlreadyInactiveError`; no write |
| `VACATION` → `VACATION` | `EmployeeAlreadyOnVacationError`; no write |

Do not change name, email, role, password, phone, or nif. Do not run `EmployeePoliciesService` (email uniqueness / inactive-email on **create** is a different command).

## Session (explicitly out)

This use case **persists** `INACTIVE` / `VACATION` / `ACTIVE`. It does **not**:

- inspect or rewrite JWTs
- blacklist tokens / bump a token version
- change `authTokenMiddleware`
- emit “logout” events
- call the auth hexagon

Today a Bearer minted while `ACTIVE` remains valid until expiry even after this write. Product rule “inactive collaborator must not keep using the API” belongs in **auth** (re-check current status after decode → `401`). The front then clears the token. Document that as a sibling; do not implement it here.

Login already refuses `status !== ACTIVE`. That stays in auth. Do not duplicate it here.

## Repository (this slice)

`EmployeeMongooseRepository` already implements create / findByEmail / findAll. Extend it:

| Method | Behavior |
|--------|----------|
| `findById` | `findById` + `lean` + `mapEmployeeDocument`; miss or invalid id → `null` |
| `updateStatus` | `updateOne` / `findByIdAndUpdate` with `{ $set: { status, deactivateAt } }` by `_id` |

No schema change. Mapper: reuse `mapEmployeeDocument`; no new full-document write mapper.

Add cases to `employee-mongoose.repository.spec.ts` (same harness as `findByEmail`). Do not add a parallel `__tests__` tree.

## Module factory

Replace the temporary inbound port in `makeEmployeesModule`:

```ts
const updateEmployeeStatus: UpdateEmployeeStatusPort = new UpdateEmployeeStatusUsecase(
  employeeRepository,
  employeeRepository,
);
```

(or equivalent: repository passed once if you bind both ports to the same instance).

Construct `UpdateEmployeeStatusController(updateEmployeeStatus)` with the **real** use case. Do not leave `throw new Error('UpdateEmployeeStatusUsecase not implemented')`.

`makeApp` / routes / `authTokenMiddleware` stay as the controller slice left them.

### Files

| File | Action |
|------|--------|
| `application/usecases/update-employee-status.usecase.ts` | Create |
| `application/usecases/update-employee-status.usecase.spec.ts` | Create |
| `application/ports/outbound/find-employee-by-id.port.ts` | Create |
| `application/ports/outbound/update-employee-status-repository.port.ts` | Create |
| `infrastructure/outbound/persistence/employee-mongoose.repository.ts` | Implement the two ports |
| `infrastructure/outbound/persistence/employee-mongoose.repository.spec.ts` | Cover `findById` + `updateStatus` |
| `employees.module.ts` | Replace temporary port with the use case |
| `src/modules/employees/AGENT.md` | Command flow, ports, wiring; drop “use case pending / temporary port” as the live contract |
| Controller, routes, `app.ts`, `employee.http`, schema, entity methods | Do not change |

## Spec expectations (`*.usecase.spec.ts`)

Mirror [`create-employee.usecase.spec.ts`](../../../src/modules/employees/application/usecases/create-employee.usecase.spec.ts):

- `makeStubs` / `makeSut` / `SutTypes`
- Stub `FindEmployeeByIdPort` + `UpdateEmployeeStatusRepositoryPort` (`satisfies`)
- Default find: a valid `toCreate` snapshot with hashed password and `status: ACTIVE`
- `afterEach` → `jest.restoreAllMocks()`
- Do **not** hit Mongo, Express, or auth
- Do **not** test HTTP status codes

Required cases:

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdateEmployeeStatusUsecase` |
| `should throw EmployeeNotFoundError when findById returns null` | reject; `updateStatus` **not** called |
| `should call findById with the given id` | `findById(id)` |
| `should deactivate an ACTIVE employee and persist INACTIVE` | `updateStatus` with `status: INACTIVE` and `deactivateAt` instanceof `Date`; result `{ id, status: INACTIVE }` |
| `should activate an INACTIVE employee and persist ACTIVE` | `deactivateAt: null`; result `ACTIVE` |
| `should put an ACTIVE employee on vacation and persist VACATION` | `deactivateAt: null`; result `VACATION` |
| `should persist INACTIVE → VACATION` | `deactivateAt: null` |
| `should persist VACATION → INACTIVE` | `deactivateAt` instanceof `Date` |
| `should persist VACATION → ACTIVE` | `deactivateAt: null` |
| `should throw EmployeeAlreadyActiveError when already ACTIVE` | no `updateStatus` |
| `should throw EmployeeAlreadyInactiveError when already INACTIVE` | no `updateStatus` |
| `should throw EmployeeAlreadyOnVacationError when already VACATION` | no `updateStatus` |
| `should not persist when the transition is rejected` | covered by the three already-in-status cases |
| `should reconstitute via Password.fromHash, not Password.create` | spy: `fromHash` called with snapshot hash; `Password.create` not used for this load |
| `should not call Encrypter or EmployeePoliciesService` | those ports are not constructor deps — assert they are absent; do not add them |
| `should propagate repository updateStatus errors` | reject with the same error |
| `should return { id, status } after a successful transition` | matches persisted status |

Do not assert JWT, middleware, or “user is logged out”.

## Checklist (agent)

- [ ] `UpdateEmployeeStatusUsecase` implements `UpdateEmployeeStatusPort`
- [ ] Injects only find-by-id + update-status outbound ports
- [ ] `null` from find → `EmployeeNotFoundError`; no write
- [ ] Transition only via `activate` / `deactivate` / `putOnVacation`
- [ ] Persist `$set` of `status` + `deactivateAt` only (never full `toJSON()` write)
- [ ] Load password with `Password.fromHash`
- [ ] Temporary module stub removed
- [ ] Co-located use-case spec covers the table above
- [ ] Repository spec covers `findById` (hit / miss / invalid id) and `updateStatus` (`$set` fields)
- [ ] `AGENT.md` matches the live command (no “pending use case”)
- [ ] No Express / Mongoose types in the use case
- [ ] No auth / session / JWT changes
- [ ] No controller / route / schema / entity-method edits

## Out of scope

- Session validity after `INACTIVE` / `VACATION` (auth middleware re-read)
- Token blacklist / `tokenVersion` / immediate cut without a new request
- Who may change whose status (authorization)
- Physical delete
- Get-by-id HTTP / update of other fields
- `404` / `409` HTTP mapping for domain errors
- Create-path “inactive email collision” / reactivation product decision

## Acceptance criteria

- [ ] `ACTIVE` + `{ status: INACTIVE }` → write `INACTIVE` + `deactivateAt` set; return `{ id, status: 'INACTIVE' }`
- [ ] `INACTIVE` + `{ status: ACTIVE }` → write `ACTIVE` + `deactivateAt: null`
- [ ] `ACTIVE` + `{ status: VACATION }` → write `VACATION` + `deactivateAt: null`
- [ ] Unknown id → `EmployeeNotFoundError`; no `updateStatus`
- [ ] Same status as current → matching `EmployeeAlready*Error`; no `updateStatus`
- [ ] Password hash in Mongo unchanged after the command
- [ ] `update-employee-status.usecase.spec.ts` passes in isolation
- [ ] `makeEmployeesModule` injects the use case (hitting the route with a valid body no longer yields `UpdateEmployeeStatusUsecase not implemented`)
- [ ] Auth module and `authTokenMiddleware` unchanged

## Open decisions (not this slice)

1. **Domain error → HTTP** — still `serverError` in the controller. `EmployeeNotFoundError` → `404` and already-in-status → `400`/`409` wait for a later spec.
2. **Auth re-check** — after decode, load current employee; if `status !== ACTIVE` → `401`. Separate auth spec. Decide there whether `VACATION` also rejects the existing session (login already blocks non-`ACTIVE`).

## Reference map

| Concern | Look at |
|---------|---------|
| Inbound port / DTOs | `application/ports/inbound/update-employee-status.port.ts`, `application/dtos/update-employee-status.dto.ts` |
| Command orchestration style | `application/usecases/create-employee.usecase.ts` |
| Transitions + errors | `domain/entities/Employee.ts`, `domain/errors/employee.errors.ts` |
| Snapshot from Mongo | `mapEmployeeDocument` in `employee.mapper.ts` |
| Password on load | `Password.fromHash` |
| Why not full `toJSON()` write | `Password.toJSON` → `'[REDACTED]'` |
| Temporary stub to replace | `employees.module.ts` |
| HTTP (do not edit) | [`controller.md`](./controller.md) |
| Session (do not implement) | `authTokenMiddleware` / auth hexagon |
