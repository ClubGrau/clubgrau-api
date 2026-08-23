# Employees Module — Agent Guide

> Living **contract** of the employees hexagon (Part 1 Create + Part 2 Get Employees + Part 3 Update Status + Part 4 Remove).
>
> Global rules (architecture, naming, testing, playbooks): [`AGENTS.md`](../../../AGENTS.md).  
> Structure diagrams / folder tree: [`docs/project-structure.md`](../../../docs/project-structure.md).

## Purpose of this document

Use this file to extend **this** module without breaking its current contracts:

- Public HTTP surface, ports, DTOs, domain invariants
- Persistence mapping and wiring specific to employees

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** when any of the following change for employees:

| Change type | Examples |
|-------------|----------|
| Public HTTP surface | New route, method, path, or response shape |
| Domain invariants | Role rules, activation policy, email uniqueness rules |
| Ports / DTOs | New inbound/outbound port, DTO fields, return contracts |
| Persistence mapping | Schema fields, mapper rules, repository responsibilities |
| Open decisions | Resolved TODOs, new known limitations |
| Module layout | New folder under this hexagon, wiring pattern change local to employees |

Global convention changes belong in [`AGENTS.md`](../../../AGENTS.md), not here.

After a meaningful change, update the relevant section(s) in place.

---

## Module status

### Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| List employees (query) | Done | `GET /api/employees` |
| Create employee (command) | Done | `POST /api/employee` |
| Update employee status (command) | Done | `POST /api/employee/update-status` |
| Remove employee (anonymize) | Done | `POST /api/employee/remove` |
| Email uniqueness policy | Done | `EmployeePoliciesService.ensureEmailIsAvailable` |
| Password confirmation | Done | `CreateEmployeeUsecase` |
| Password hashing | Done | `EncrypterPort` → `BcryptAdapter` (injected from `app.ts`) |
| Mongo persistence | Done | `EmployeeMongooseRepository` |
| Auth token on employee routes | Done | `authTokenMiddleware` on `GET` / `POST /employee` / `POST /employee/update-status` / `POST /employee/remove` |
| Module HTTP ownership | Done | `infrastructure/inbound/http/employee.routes.ts` |
| Composition root wiring | Done | `employees.module.ts` + `app.ts` |

### CQRS in this module

| Side | Location | Example |
|------|----------|---------|
| Command (write) | `application/usecases/` | `CreateEmployeeUsecase`, `UpdateEmployeeStatusUsecase`, `RemoveEmployeeUsecase` |
| Query (read) | `application/queries/` | `GetEmployeesQuery` |

Queries do **not** call `Employee.create`, policies, or encrypter. They use a dedicated read model DTO (no `password`) and `FindEmployeesPort`.

### Future work

- Get employee by id / update other fields
- Authorization (who may create/list employees) beyond token presence
- Cross-module events / integration beyond this hexagon

---

## Directory map

```text
src/modules/employees/
├── AGENT.md                          # this file (module contract)
├── employees.module.ts               # composition / DI for the hexagon
│
├── domain/
│   ├── entities/
│   │   ├── Employee.ts
│   │   └── employee.spec.ts
│   ├── models/
│   │   ├── employee.model.ts         # Role, Status, OperationalStatus, isRole
│   │   └── employee.model.spec.ts
│   ├── ports/
│   │   ├── find-employee-by-email.port.ts
│   │   └── count-non-removed-admins.port.ts
│   ├── errors/
│   │   └── employee.errors.ts
│   └── services/
│       ├── employee-policies.service.ts
│       ├── employee-policies.service.spec.ts
│       ├── employee-lifecycle.policy.ts
│       └── employee-lifecycle.policy.spec.ts
│
├── application/
│   ├── dtos/
│   │   ├── create-employee.dto.ts
│   │   ├── create-employee.dto.spec.ts
│   │   ├── get-employees.dto.ts      # filters + read model (no password)
│   │   ├── get-employees.dto.spec.ts
│   │   ├── update-employee-status.dto.ts
│   │   └── remove-employee.dto.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   ├── create-employee.port.ts
│   │   │   ├── get-employees.port.ts
│   │   │   ├── update-employee-status.port.ts
│   │   │   └── remove-employee.port.ts
│   │   └── outbound/
│   │       ├── create-employee-repository.port.ts
│   │       ├── find-employees.port.ts
│   │       ├── find-employee-by-id.port.ts
│   │       ├── update-employee-status-repository.port.ts
│   │       └── anonymize-employee-repository.port.ts
│   ├── usecases/
│   │   ├── create-employee.usecase.ts
│   │   ├── create-employee.usecase.spec.ts
│   │   ├── update-employee-status.usecase.ts
│   │   ├── update-employee-status.usecase.spec.ts
│   │   ├── remove-employee.usecase.ts
│   │   └── remove-employee.usecase.spec.ts
│   └── queries/
│       ├── get-employees.query.ts
│       └── get-employees.query.spec.ts
│
├── presentation/
│   ├── http/
│   │   ├── get-employees.request.ts  # query string bruta (pré-validação)
│   │   ├── update-employee-status.request.ts  # body bruto (id/status); actorId do adaptRoute
│   │   └── remove-employee.request.ts         # body bruto (id/password); actorId do adaptRoute
│   └── controllers/
│       ├── create-employee.controller.ts
│       ├── create-employee.controller.spec.ts
│       ├── get-employees.controller.ts
│       ├── get-employees.controller.spec.ts
│       ├── update-employee-status.controller.ts
│       ├── update-employee-status.controller.spec.ts
│       ├── remove-employee.controller.ts
│       └── remove-employee.controller.spec.ts
│
└── infrastructure/
    ├── inbound/http/
    │   └── employee.routes.ts
    └── outbound/persistence/
        ├── employee.schema.ts
        ├── employee.mapper.ts        # mapEmployeeDocument + mapEmployeeReadModel
        ├── employee-mongoose.repository.ts
        └── employee-mongoose.repository.spec.ts
```

Related outside the module:

| Path | Role |
|------|------|
| `src/app.ts` | Injects `connection` + `BcryptAdapter` (`encrypter` + `compareHash`) + `authTokenMiddleware`, mounts `/api` |
| `src/shared/**` | Entity base, VOs, EncrypterPort, CompareHashPort, BaseController, adaptRoute, offset pagination |
| `src/client/employee.http` | Manual REST Client requests |
| [`AGENTS.md`](../../../AGENTS.md) | Global constitution |
| [`docs/project-structure.md`](../../../docs/project-structure.md) | Repo-wide structure diagrams |

---

## Domain model

Glossary: [`CONTEXT.md`](./CONTEXT.md). Map: [`CONTEXT-MAP.md`](../../../CONTEXT-MAP.md).

### `Employee` entity

Factory methods:

- `Employee.create(CreateEmployeeProps)` — new employee; validates role; builds VOs; defaults `status=ACTIVE`, `createdAt=now`, `deactivateAt=null`.
- `Employee.reconstitute(ReconstituteEmployeeProps)` — rebuild from persistence (already-validated VOs + id).

Behavior:

- `activate()` / `deactivate()` / `putOnVacation()` — used by `UpdateEmployeeStatusUsecase`
- `anonymize()` — used by `RemoveEmployeeUsecase` (sentinel name/email, `status=REMOVED`, `removedAt=now`)
- `changePassword` (accepts `Password.fromHash` for the random secret), `changeRole`, `changeName`, `changeEmail`, `changePhone`, `assignNif`
- Convenience getter `isActive` → `status === ACTIVE` (not persisted)

Snapshot for persistence / outbound **write** ports comes from `employee.toJSON()` and is typed as `EmployeeModel.toCreate`.

### `EmployeeModel`

```ts
enum Role { ADMIN, MANAGER, EMPLOYEE }
enum Status { ACTIVE, INACTIVE, VACATION, REMOVED }
type OperationalStatus = Status.ACTIVE | Status.INACTIVE | Status.VACATION
type toCreate = ReturnType<Employee['toJSON']>
function isRole(value: unknown): value is Role
function isStatus(value: unknown): value is Status
function isOperationalStatus(value: unknown): value is OperationalStatus
```

`toCreate` is the write/persistence snapshot (includes `password`). List/get responses must use `GetEmployeesItemDto` instead.

### Domain errors (`employee.errors.ts`)

| Error | When |
|-------|------|
| `InvalidEmployeeRoleError` | Role not in `EmployeeModel.Role` |
| `InvalidEmployeeStatusError` | Status not in `EmployeeModel.Status` |
| `PasswordNotMatchError` | `password !== passwordConfirmation` |
| `EmployeeAlreadyExistsError` | Email found and employee is ACTIVE |
| `EmployeeInactiveError` | Email found but employee is not ACTIVE |
| `EmployeeAlreadyActiveError` | `activate()` on already-active employee |
| `EmployeeAlreadyInactiveError` | `deactivate()` on already-inactive employee |
| `EmployeeAlreadyOnVacationError` | `putOnVacation()` on already-on-vacation employee |
| `EmployeeNotFoundError` | Lookup by id found nothing |
| `ActorAuthenticationFailedError` | Actor missing/blank, not found, or not ACTIVE |
| `EmployeeLifecycleForbiddenError` | Actor role/intent outside the lifecycle matrix |
| `LastAdminProtectedError` | Last non-REMOVED ADMIN leaving ACTIVE |
| `EmployeeAlreadyRemovedError` | Target already `REMOVED` |
| `EmployeeNotInactiveError` | Remove-only — target is not `INACTIVE` |

All extend `@shared/domain/errors/domain.error`.

### `EmployeePoliciesService`

Current policy: `ensureEmailIsAvailable(email)`

| Lookup result | Outcome |
|---------------|---------|
| Not found | OK — email available |
| Found + ACTIVE | `EmployeeAlreadyExistsError` |
| Found + not ACTIVE | `EmployeeInactiveError` (reactivation is an open product decision; do not silently create a duplicate) |

Depends on domain port `FindEmployeeByEmailPort` (not on Mongoose).

---

## Application: Create Employee (command)

### Ports

```ts
// inbound
interface CreateEmployeePort {
  execute(params: CreateEmployeeDto): Promise<CreateEmployeeResultDto>;
}

// outbound
interface CreateEmployeeRepositoryPort {
  create(employee: EmployeeModel.toCreate): Promise<CreateEmployeeResultDto>;
}
```

### DTOs

```ts
interface CreateEmployeeDto {
  name: string;
  email: string;
  role: EmployeeModel.Role;
  phone?: string | null;
  nif?: number | null;
  password: string;
  passwordConfirmation: string;
}

interface CreateEmployeeResultDto {
  id: string;
}
```

### Use case flow (`CreateEmployeeUsecase`)

1. Reject if `password !== passwordConfirmation` → `PasswordNotMatchError`
2. `Employee.create(...)` then `.toJSON()` (VO validation happens here)
3. `employeePoliciesService.ensureEmailIsAvailable(email)`
4. Encrypt password via `EncrypterPort`
5. Persist via `CreateEmployeeRepositoryPort.create`
6. Return `{ id }`

Optional `phone` is validated by `Phone.create` inside `Employee.create` (omit/`null` → `null`).

---

## Application: Get Employees (query)

Offset pagination lives in `@shared/application/pagination` (`normalizePagination`, `toPaginatedResult`). Module DTOs compose that contract.

### Ports

```ts
// inbound
interface GetEmployeesPort {
  execute(filters: GetEmployeesDto): Promise<GetEmployeesResultDto>;
}

// outbound
interface FindEmployeesPort {
  findAll(params: FindEmployeesParams): Promise<FindEmployeesResult>;
}
```

### DTOs

```ts
interface GetEmployeesDto extends PaginationInputDto {
  status?: EmployeeModel.OperationalStatus;
  role?: EmployeeModel.Role;
  search?: string;
  // page?: number | string; limit?: number | string; (from shared)
}

interface GetEmployeesItemDto {
  id: string;
  name: string;
  email: string;
  role: EmployeeModel.Role;
  phone: string | null;
  nif: string | null;
  status: EmployeeModel.Status;
  createdAt: Date;
  deactivateAt: Date | null;
}

interface FindEmployeesParams {
  status?: EmployeeModel.OperationalStatus;
  role?: EmployeeModel.Role;
  search?: string;
  skip: number;
  limit: number;
}

interface FindEmployeesResult {
  items: GetEmployeesItemDto[];
  total: number;
}

interface GetEmployeesResultDto {
  employees: GetEmployeesItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

Defaults: `page=1`, `limit=20`, `max limit=100` (shared).

### Query flow (`GetEmployeesQuery`)

1. `normalizePagination(filters)` → `{ page, limit, skip }`
2. Trim `search` (blank→omit); forward `status` / `role` as-is (no boolean mapping)
3. `FindEmployeesPort.findAll({ status, role, search, skip, limit })` → `{ items, total }`
4. Map via `toPaginatedResult` into `{ employees, page, limit, total, totalPages }`

`total` / `totalPages` always reflect the **filtered** set (`countDocuments` uses the same filter).

No domain entity creation, no policies, no encrypter.

---

## Application: Update Employee Status (command)

### Ports

```ts
// inbound
interface UpdateEmployeeStatusPort {
  execute(params: UpdateEmployeeStatusDto): Promise<UpdateEmployeeStatusResultDto>;
}

// outbound
interface FindEmployeeByIdPort {
  findById(id: string): Promise<EmployeeModel.toCreate | null>;
}

interface UpdateEmployeeStatusRepositoryPort {
  updateStatus(params: { id: string; status: EmployeeModel.Status; deactivateAt: Date | null }): Promise<void>;
}
```

### DTOs

```ts
interface UpdateEmployeeStatusDto {
  actorId: string;                          // stampado pelo adaptRoute; nunca do body
  id: string;
  status: EmployeeModel.OperationalStatus;  // REMOVED bloqueado no controller
}

interface UpdateEmployeeStatusResultDto {
  id: string;
  status: EmployeeModel.Status;
}
```

### Use case flow (`UpdateEmployeeStatusUsecase`)

1. `actorId` empty/blank → `ActorAuthenticationFailedError` (opaque; do not leak)
2. `FindEmployeeByIdPort.findById(actorId)` — miss → `ActorAuthenticationFailedError`
3. `FindEmployeeByIdPort.findById(id)` — miss → `EmployeeNotFoundError`
4. `Employee.reconstitute` Actor and Target (`Password.fromHash`; `removedAt: snapshot.removedAt ?? null`; never `Employee.create`)
5. Map status → intent: `ACTIVE→REACTIVATE`, `INACTIVE→DEACTIVATE`, `VACATION→VACATION`
6. `EmployeeLifecyclePolicy.assertCan({ actor, target, intent })`
7. Apply the requested status via entity methods:
   - `INACTIVE` → `deactivate()` (`deactivateAt = now`)
   - `ACTIVE` → `activate()` (`deactivateAt = null`)
   - `VACATION` → `putOnVacation()` (`deactivateAt = null`)
   - same status as current → `EmployeeAlreadyActiveError` / `EmployeeAlreadyInactiveError` / `EmployeeAlreadyOnVacationError` (no write)
8. Persist **only** `{ status, deactivateAt }` via `UpdateEmployeeStatusRepositoryPort.updateStatus` (`$set`). Do **not** write `employee.toJSON()` as a full document (`Password.toJSON()` is `'[REDACTED]'`).
9. Return `{ id, status }` after the transition

No encrypter. No email policies. Session / JWT validity after `INACTIVE` is **not** this command (auth hexagon).

`REMOVED` is **not** a legal `status` on this command. Do not route Remove through `activate` / `deactivate` / `putOnVacation`. If it reaches the use case, throw `InvalidEmployeeStatusError`.

---

## Application: Remove Employee (command)

Product decisions (2026-08-21): see PRD [`docs/prd/employee-lifecycle-v1.md`](../../../docs/prd/employee-lifecycle-v1.md). Anonymize (not hard delete); actor password; only from `INACTIVE`; ADMIN-only Remove; MANAGER only Deactivate/Reactivate `EMPLOYEE`; Last Admin stays `ACTIVE`; list excludes `REMOVED`; new Create with the freed email does **not** inherit the old identity.

Front: **ADMIN** on `INACTIVE` → **Reactivate** or **Remove**. **MANAGER** on `INACTIVE` **`EMPLOYEE`** → **Reactivate** only. Do not offer Remove from `ACTIVE` / `VACATION`.

### Why anonymize

The Mongo `_id` must survive so other contexts can keep an `employeeId`. What those contexts do is **not** this command. After Remove:

| Field | After anonymize |
|-------|-----------------|
| `_id` | unchanged |
| `status` | `REMOVED` (terminal; not an operational status) |
| `name` | sentinel that satisfies `Name` (e.g. `Removed`) |
| `email` | unique sentinel `removed.{id}@anonymized.invalid` — original email is free |
| `phone` / `nif` | `null` |
| `password` | new unusable hash (random secret via `EncrypterPort`) — old password never matches |
| `role` | unchanged (for audit); last-ADMIN checks **ignore** `REMOVED` |
| `removedAt` | `now` |
| `deactivateAt` | left as set by the prior `INACTIVE` transition |

### Ports

```ts
interface RemoveEmployeePort {
  execute(params: RemoveEmployeeDto): Promise<RemoveEmployeeResultDto>;
}

interface RemoveEmployeeDto {
  actorId: string;        // JWT — never from the client body
  targetId: string;       // body.id
  actorPassword: string;  // body.password — actor, not target
}

interface RemoveEmployeeResultDto {
  id: string;
}

interface AnonymizeEmployeeRepositoryPort {
  anonymize(params: {
    id: string;
    name: string;
    email: string;
    phone: null;
    nif: null;
    password: string;
    status: EmployeeModel.Status.REMOVED;
    removedAt: Date;
  }): Promise<void>;
}
```

Persist with `$set` of those fields only. Do **not** write `employee.toJSON()` as a full document (`Password.toJSON()` is `'[REDACTED]'`).

### Use case flow (`RemoveEmployeeUsecase`)

1. `actorId` empty/blank → `ActorAuthenticationFailedError` (opaque; do not leak)
2. `FindEmployeeByIdPort.findById(actorId)` — miss → `ActorAuthenticationFailedError`
3. `CompareHashPort.compare(actorPassword, actorSnapshot.password)` — false or throw → `ActorAuthenticationFailedError` (same opacity as login). Step-up runs **before** loading the Target.
4. `FindEmployeeByIdPort.findById(targetId)` — miss → `EmployeeNotFoundError`
5. `Employee.reconstitute` Actor and Target (`Password.fromHash`; `removedAt: snapshot.removedAt ?? null`)
6. `EmployeeLifecyclePolicy.assertCan({ actor, target, intent: 'REMOVE' })` — self-remove, MANAGER/EMPLOYEE actor, Last Admin, not `INACTIVE`, already `REMOVED`
7. Encrypt a random secret (`crypto.randomBytes` in the use case) via `EncrypterPort`; `target.anonymize()` then `changePassword(Password.fromHash(hash))`
8. Persist via `AnonymizeEmployeeRepositoryPort.anonymize(...)` with the hash (never `toJSON().password`)
9. Return `{ id }`

List (`GET /api/employees`): **exclude `REMOVED` by default**. `update-status` must keep using operational statuses only (`ACTIVE` \| `INACTIVE` \| `VACATION`). `ensureEmailIsAvailable` stays as-is for `INACTIVE` (email still occupied until Remove). After anonymize, `findByEmail(original)` returns nothing → create may reuse the email.

Out of this command: JWT blacklist (auth); behaviour of other modules that store `employeeId`.

---

## Presentation & HTTP

### Controllers

`CreateEmployeeController` extends `BaseController`:

- Required fields: `name`, `email`, `password`, `passwordConfirmation`
- Missing field → `400` + `MissingParamError`
- Success → `201` + `{ id }` via `created(...)`
- Unexpected errors → `serverError(...)`

`role` / `phone` / `nif` are passed through when present; domain validates role and VOs.

`GetEmployeesController` extends `BaseController`:

- No required fields
- Normalizes query-string filters: `status` via `EmployeeModel.isOperationalStatus` (`ACTIVE`|`INACTIVE`|`VACATION`; `REMOVED` → `400`), `role`, `search` (trim), `page`, `limit`
- Invalid `status` (including `REMOVED`) or `role` → `400` + `InvalidParamError`
- Success → `200` + `{ data: { employees, page, limit, total, totalPages } }` via `ok(...)`
- Unexpected errors → `serverError(...)`

HTTP list contract example:

```http
GET /api/employees?page=1&limit=20&status=ACTIVE&role=MANAGER&search=grau
```

`UpdateEmployeeStatusController` extends `BaseController`:

- Required fields: `id`, `status` — do **not** require `actorId` as a missing-param
- Missing field → `400` + `MissingParamError`
- Invalid `status` (not `ACTIVE`|`INACTIVE`|`VACATION`, including `REMOVED`) → `400` + `InvalidParamError`
- Forwards `{ actorId: String(request.actorId ?? ''), id, status }` — Actor comes from `adaptRoute` (JWT), never from the body
- Success → `200` + `{ id, status }` via `ok(...)`
- Raw HTTP body: `UpdateEmployeeStatusRequest` (`id`/`status` as string, optional `actorId` stamped by the adapter); typed DTO is produced after validation

| Domain error | HTTP |
|--------------|------|
| `ActorAuthenticationFailedError` | `401` `unauthorized` |
| `EmployeeLifecycleForbiddenError` | `403` `forbidden` |
| `LastAdminProtectedError` | `409` `conflict` |
| `EmployeeAlreadyRemovedError` | `409` `conflict` |
| `EmployeeNotFoundError` | `400` `badRequest` |
| `EmployeeAlreadyActiveError` / `EmployeeAlreadyInactiveError` / `EmployeeAlreadyOnVacationError` | `400` `badRequest` |
| anything else | `500` `serverError` |

HTTP update-status contract example:

```http
POST /api/employee/update-status
Authorization: Bearer <actor token>
{ "id": "507f1f77bcf86cd799439011", "status": "INACTIVE" }
```

Do not send `actorId` in the body. The adapter overwrites any forged value with the JWT id.

`RemoveEmployeeController` extends `BaseController`:

- Required fields: `id`, `password` — do **not** require `actorId` as a missing-param
- Missing field → `400` + `MissingParamError`
- Forwards `{ actorId: String(request.actorId ?? ''), targetId: String(id), actorPassword: String(password) }` — Actor comes from `adaptRoute` (JWT), never from the body
- Success → `200` + `{ id }` via `ok(...)`
- Raw HTTP body: `RemoveEmployeeRequest` (`id`/`password` as string, optional `actorId` stamped by the adapter); typed DTO is produced after validation

| Domain error | HTTP |
|--------------|------|
| `ActorAuthenticationFailedError` | `401` `unauthorized` |
| `EmployeeLifecycleForbiddenError` | `403` `forbidden` |
| `LastAdminProtectedError` | `409` `conflict` |
| `EmployeeNotInactiveError` | `409` `conflict` |
| `EmployeeAlreadyRemovedError` | `409` `conflict` |
| `EmployeeNotFoundError` | `400` `badRequest` |
| anything else | `500` `serverError` |

HTTP remove contract example:

```http
POST /api/employee/remove
Authorization: Bearer <actor token>
{ "id": "<target>", "password": "<actor password>" }
```

Do not send `actorId` in the body. `password` is the Actor’s (step-up), not the Target’s.

### Routes

```ts
// employee.routes.ts
router.get('/employees', authTokenMiddleware, adaptRoute(getEmployeesController));
router.post('/employee', authTokenMiddleware, adaptRoute(createEmployeeController));
router.post('/employee/update-status', authTokenMiddleware, adaptRoute(updateEmployeeStatusController));
router.post('/employee/remove', authTokenMiddleware, adaptRoute(removeEmployeeController));
```

Mounted in `app.ts` as:

```text
GET  /api/employees
POST /api/employee
POST /api/employee/update-status
POST /api/employee/remove
```

All require `Authorization` (Bearer token). Manual samples: `src/client/employee.http`.

### Request → response sequences

**Create**

```text
Client
  → employee.routes + authTokenMiddleware + adaptRoute
  → CreateEmployeeController.handle
  → CreateEmployeePort.execute
  → CreateEmployeeUsecase
      → Employee.create
      → EmployeePoliciesService.ensureEmailIsAvailable
          → FindEmployeeByEmailPort (repo)
      → EncrypterPort.encrypt
      → CreateEmployeeRepositoryPort.create
  → 201 { data: { id } }
```

**List**

```text
Client
  → employee.routes + authTokenMiddleware + adaptRoute
  → GetEmployeesController.handle
  → GetEmployeesPort.execute
  → GetEmployeesQuery
      → normalizePagination
      → FindEmployeesPort.findAll ({ skip, limit, filters })
  → 200 { data: { employees, page, limit, total, totalPages } }
```

**Update status**

```text
Client
  → employee.routes + authTokenMiddleware + adaptRoute (stamps actorId from JWT)
  → UpdateEmployeeStatusController.handle
  → UpdateEmployeeStatusPort.execute
  → UpdateEmployeeStatusUsecase
      → FindEmployeeByIdPort.findById (actor) — miss → ActorAuthenticationFailedError
      → FindEmployeeByIdPort.findById (target) — miss → EmployeeNotFoundError
      → Employee.reconstitute (actor + target)
      → map status → intent
      → EmployeeLifecyclePolicy.assertCan
      → activate / deactivate / putOnVacation
      → UpdateEmployeeStatusRepositoryPort.updateStatus ({ status, deactivateAt })
  → 200 { data: { id, status } }
```

**Remove**

```text
Client
  → employee.routes + authTokenMiddleware + adaptRoute (stamps actorId from JWT)
  → RemoveEmployeeController.handle
  → RemoveEmployeePort.execute
  → RemoveEmployeeUsecase
      → FindEmployeeByIdPort.findById (actor) — miss → ActorAuthenticationFailedError
      → CompareHashPort.compare (actor password vs snapshot hash) — fail → ActorAuthenticationFailedError
      → FindEmployeeByIdPort.findById (target) — miss → EmployeeNotFoundError
      → Employee.reconstitute (actor + target)
      → EmployeeLifecyclePolicy.assertCan ({ intent: REMOVE })
      → EncrypterPort.encrypt (random secret)
      → Employee.anonymize + changePassword(Password.fromHash)
      → AnonymizeEmployeeRepositoryPort.anonymize ($set sentinels + hash)
  → 200 { data: { id } }
```

---

## Persistence

### Schema highlights

- Unique index on `email`
- `role` enum: `ADMIN | MANAGER | EMPLOYEE`
- Fields: `name`, `email`, `role`, `password`, `phone`, `nif`, `status`, `createdAt`, `deactivateAt`, `removedAt`
- `status` enum: `ACTIVE | INACTIVE | VACATION | REMOVED` (default `ACTIVE`)
- `removedAt`: `Date | null` (default `null`)

### Repository

`EmployeeMongooseRepository` implements:

- `CreateEmployeeRepositoryPort` → `create`
- `FindEmployeeByEmailPort` → `findByEmail` (lean + `mapEmployeeDocument`)
- `FindEmployeeByIdPort` → `findById` (lean + `mapEmployeeDocument`; invalid ObjectId → `null`)
- `FindEmployeesPort` → `findAll` (`find` + `sort` + `skip` + `limit` + `countDocuments` + `mapEmployeeReadModel`)
- `UpdateEmployeeStatusRepositoryPort` → `updateStatus` (`updateOne` + `$set` of `status` and `deactivateAt` only)
- `CountNonRemovedAdminsPort` → `countNonRemovedAdmins`
- `AnonymizeEmployeeRepositoryPort` → `anonymize` (`updateOne` + `$set` of sentinel fields + hash + `REMOVED` + `removedAt` only)

`findAll` sorts by `{ createdAt: -1, _id: -1 }` for stable pages.

Optional `search` builds a case-insensitive `$or` over `name`, `email`, `phone`, and `nif` (`$expr` + `$toString` because `nif` is stored as Number). Regex metacharacters in `search` are escaped.

### Mapper rules

- Document `_id` ↔ string `id`
- `phone`: string (or null) in Mongo ↔ string (or null) in snapshots / read models
- `nif`: number in Mongo ↔ string (or null) in snapshots / read models
- Defaults for missing dates when reading lean documents
- `mapEmployeeDocument` → `EmployeeModel.toCreate` (includes `password`) — write/lookup path
- `mapEmployeeReadModel` → `GetEmployeesItemDto` (**omits `password`**) — list path

When adding fields: update **schema → mapper → entity props / create props → DTOs** in that order of concern, and keep domain free of Mongoose types.

---

## Wiring (`employees.module.ts`)

Factory: `makeEmployeesModule({ connection, encrypter, compareHash, authTokenMiddleware })`.

`app.ts` passes the same `BcryptAdapter` instance as `encrypter` and `compareHash`.

Composition order today:

1. `connection.model('Employee', EmployeeSchema)`
2. `EmployeeMongooseRepository`
3. `EmployeePoliciesService(repository)`
4. `CreateEmployeeUsecase(policies, encrypter, repository)`
5. `GetEmployeesQuery(repository)`
6. `CreateEmployeeController(createEmployee)`
7. `GetEmployeesController(getEmployees)`
8. `EmployeeLifecyclePolicy(repository)` — one instance shared by update-status and remove
9. `UpdateEmployeeStatusUsecase(repository, repository, lifecyclePolicy)`
10. `UpdateEmployeeStatusController(updateEmployeeStatus)`
11. `RemoveEmployeeUsecase(repository, compareHash, encrypter, lifecyclePolicy, repository)`
12. `RemoveEmployeeController(removeEmployee)`
13. `makeEmployeeRoutes({ createEmployeeController, getEmployeesController, updateEmployeeStatusController, removeEmployeeController, authTokenMiddleware })`

Returns `{ createEmployeeController, getEmployeesController, updateEmployeeStatusController, removeEmployeeController, createEmployee, getEmployees, router }`.

**Rule:** when adding a use case or query, wire it in this file; do not construct repositories inside controllers or use cases.

---

## Module checklist (extend employees)

Follow the global playbook in [`AGENTS.md`](../../../AGENTS.md). For this module specifically:

1. Domain / DTO / ports / use case or query / controller / route / repo as needed + specs
2. Wire in `employees.module.ts`
3. Update `src/client/employee.http` if HTTP surface changed
4. Update **this** `AGENT.md` (status, ports, HTTP, open decisions)

Example next command: get employee by id — add query, read port, controller, route, then update this file.

Never shortcut by calling the repository from the controller.

---

## Open decisions / known limitations

1. **Inactive email collision** — **resolved in product, not yet in code.** `INACTIVE` still occupies the email (`EmployeeInactiveError` on create). Same person returns via **Reactivate**. A new person needs that email only after **Remove**. The INACTIVE screen is the fork: Reactivate **or** Remove.
2. **Authorization** — `update-status` and `remove` enforce the lifecycle matrix via `EmployeeLifecyclePolicy` (MANAGER only `EMPLOYEE`; Last Admin stays `ACTIVE`; EMPLOYEE actor refused; only ADMIN may Remove). Create/list still only check token presence.
3. **Error HTTP mapping** — create-path failures mostly go through `serverError`; list filters map invalid `status`/`role` to `400`. `update-status` and `remove` map Actor/policy/already-in-status errors to `401`/`403`/`409`/`400` (see tables above).
4. **Session after INACTIVE / REMOVED** — update-status and Remove only persist the employee document. An existing JWT remains valid until expiry unless auth re-checks current status on each request.
5. **CompareHashPort** — resolved as a dedicated `@shared/application/ports/compare-hash.port.ts`. `BcryptAdapter` implements both `EncrypterPort` and `CompareHashPort`; `app.ts` injects the same instance.

---

## Quick reference: file ownership

| Concern | Owner file |
|---------|------------|
| Business creation rules | `domain/entities/Employee.ts` |
| Role / write snapshot types | `domain/models/employee.model.ts` |
| Email availability | `domain/services/employee-policies.service.ts` |
| Lifecycle matrix (Actor / Target / Last Admin) | `domain/services/employee-lifecycle.policy.ts` |
| Create orchestration (command) | `application/usecases/create-employee.usecase.ts` |
| Update-status orchestration (command) | `application/usecases/update-employee-status.usecase.ts` |
| List orchestration (query) | `application/queries/get-employees.query.ts` |
| List read model DTOs | `application/dtos/get-employees.dto.ts` |
| Create HTTP validation / status | `presentation/controllers/create-employee.controller.ts` |
| List HTTP request shape (raw query) | `presentation/http/get-employees.request.ts` |
| List HTTP mapping / status | `presentation/controllers/get-employees.controller.ts` |
| Update-status HTTP request shape (raw body) | `presentation/http/update-employee-status.request.ts` |
| Update-status HTTP mapping / status | `presentation/controllers/update-employee-status.controller.ts` |
| Remove (anonymize) orchestration | `application/usecases/remove-employee.usecase.ts` |
| Remove HTTP request shape (raw body) | `presentation/http/remove-employee.request.ts` |
| Remove HTTP mapping / status | `presentation/controllers/remove-employee.controller.ts` |
| Routes | `infrastructure/inbound/http/employee.routes.ts` |
| Mongo I/O | `infrastructure/outbound/persistence/employee-mongoose.repository.ts` |
| Document ↔ DTO mapping | `infrastructure/outbound/persistence/employee.mapper.ts` |
| DI | `employees.module.ts` |
| App mount | `src/app.ts` → `app.use('/api', employees.router)` |
| Offset pagination (shared) | `src/shared/application/pagination/pagination.dto.ts` |
