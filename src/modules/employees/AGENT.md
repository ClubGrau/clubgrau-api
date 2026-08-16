# Employees Module — Agent Guide

> Living **contract** of the employees hexagon (Part 1 Create + Part 2 Get Employees).
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
| Email uniqueness policy | Done | `EmployeePoliciesService.ensureEmailIsAvailable` |
| Password confirmation | Done | `CreateEmployeeUsecase` |
| Password hashing | Done | `EncrypterPort` → `BcryptAdapter` (injected from `app.ts`) |
| Mongo persistence | Done | `EmployeeMongooseRepository` |
| Auth token on employee routes | Done | `authTokenMiddleware` on `GET` / `POST /employee` |
| Module HTTP ownership | Done | `infrastructure/inbound/http/employee.routes.ts` |
| Composition root wiring | Done | `employees.module.ts` + `app.ts` |

### CQRS in this module

| Side | Location | Example |
|------|----------|---------|
| Command (write) | `application/usecases/` | `CreateEmployeeUsecase` |
| Query (read) | `application/queries/` | `GetEmployeesQuery` |

Queries do **not** call `Employee.create`, policies, or encrypter. They use a dedicated read model DTO (no `password`) and `FindEmployeesPort`.

### Future work

- Get employee by id / update / deactivate / reactivate
- Authorization (who may create/list employees) beyond token presence
- Explicit reactivation flow for inactive employees with the same email
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
│   │   ├── employee.model.ts         # Role, toCreate, isRole
│   │   └── employee.model.spec.ts
│   ├── ports/
│   │   └── find-employee-by-email.port.ts
│   ├── errors/
│   │   └── employee.errors.ts
│   └── services/
│       ├── employee-policies.service.ts
│       └── employee-policies.service.spec.ts
│
├── application/
│   ├── dtos/
│   │   ├── create-employee.dto.ts
│   │   ├── create-employee.dto.spec.ts
│   │   ├── get-employees.dto.ts      # filters + read model (no password)
│   │   └── get-employees.dto.spec.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   ├── create-employee.port.ts
│   │   │   └── get-employees.port.ts
│   │   └── outbound/
│   │       ├── create-employee-repository.port.ts
│   │       └── find-employees.port.ts
│   ├── usecases/
│   │   ├── create-employee.usecase.ts
│   │   └── create-employee.usecase.spec.ts
│   └── queries/
│       ├── get-employees.query.ts
│       └── get-employees.query.spec.ts
│
├── presentation/
│   └── controllers/
│       ├── create-employee.controller.ts
│       ├── create-employee.controller.spec.ts
│       ├── get-employees.controller.ts
│       └── get-employees.controller.spec.ts
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
| `src/app.ts` | Injects `connection` + `BcryptAdapter` + `authTokenMiddleware`, mounts `/api` |
| `src/shared/**` | Entity base, VOs, EncrypterPort, BaseController, adaptRoute, offset pagination |
| `src/client/employee.http` | Manual REST Client requests |
| [`AGENTS.md`](../../../AGENTS.md) | Global constitution |
| [`docs/project-structure.md`](../../../docs/project-structure.md) | Repo-wide structure diagrams |

---

## Domain model

### `Employee` entity

Factory methods:

- `Employee.create(CreateEmployeeProps)` — new employee; validates role; builds VOs; defaults `isActive=true`, `createdAt=now`, `deactivateAt=null`.
- `Employee.reconstitute(ReconstituteEmployeeProps)` — rebuild from persistence (already-validated VOs + id).

Behavior already on the entity (for future use cases):

- `activate()` / `deactivate()`
- `changePassword`, `changeRole`, `changeName`, `changeEmail`, `changePhone`, `assignNif`

Snapshot for persistence / outbound **write** ports comes from `employee.toJSON()` and is typed as `EmployeeModel.toCreate`.

### `EmployeeModel`

```ts
enum Role { ADMIN, MANAGER, EMPLOYEE }
type toCreate = ReturnType<Employee['toJSON']>
function isRole(value: unknown): value is Role
```

`toCreate` is the write/persistence snapshot (includes `password`). List/get responses must use `GetEmployeesItemDto` instead.

### Domain errors (`employee.errors.ts`)

| Error | When |
|-------|------|
| `InvalidEmployeeRoleError` | Role not in `EmployeeModel.Role` |
| `PasswordNotMatchError` | `password !== passwordConfirmation` |
| `EmployeeAlreadyExistsError` | Email found and employee is active |
| `EmployeeInactiveError` | Email found but employee is inactive |
| `EmployeeAlreadyActiveError` | `activate()` on already-active employee |
| `EmployeeAlreadyInactiveError` | `deactivate()` on already-inactive employee |
| `EmployeeNotFoundError` | Reserved for future lookups |

All extend `@shared/domain/errors/domain.error`.

### `EmployeePoliciesService`

Current policy: `ensureEmailIsAvailable(email)`

| Lookup result | Outcome |
|---------------|---------|
| Not found | OK — email available |
| Found + active | `EmployeeAlreadyExistsError` |
| Found + inactive | `EmployeeInactiveError` (reactivation is an open product decision; do not silently create a duplicate) |

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
type EmployeeListStatus = 'active' | 'inactive'

interface GetEmployeesDto extends PaginationInputDto {
  status?: EmployeeListStatus;
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
  isActive: boolean; // read-model field (not the list filter param)
  createdAt: Date;
  deactivateAt: Date | null;
}

interface FindEmployeesParams {
  isActive?: boolean; // mapped from status in the query
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
2. Map `status` → `isActive` (`active`→`true`, `inactive`→`false`, omit→no filter); trim `search` (blank→omit)
3. `FindEmployeesPort.findAll({ isActive, role, search, skip, limit })` → `{ items, total }`
4. Map via `toPaginatedResult` into `{ employees, page, limit, total, totalPages }`

`total` / `totalPages` always reflect the **filtered** set (`countDocuments` uses the same filter).

No domain entity creation, no policies, no encrypter.

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
- Normalizes query-string filters: `status` (`active`|`inactive`), `role`, `search` (trim), `page`, `limit`
- Invalid `status` or `role` → `400` + `InvalidParamError`
- Success → `200` + `{ data: { employees, page, limit, total, totalPages } }` via `ok(...)`
- Unexpected errors → `serverError(...)`

HTTP list contract example:

```http
GET /api/employees?page=1&limit=20&status=active&role=MANAGER&search=grau
```

### Routes

```ts
// employee.routes.ts
router.get('/employees', authTokenMiddleware, adaptRoute(getEmployeesController));
router.post('/employee', authTokenMiddleware, adaptRoute(createEmployeeController));
```

Mounted in `app.ts` as:

```text
GET  /api/employees
POST /api/employee
```

Both require `Authorization` (Bearer token). Manual samples: `src/client/employee.http`.

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

---

## Persistence

### Schema highlights

- Unique index on `email`
- `role` enum: `ADMIN | MANAGER | EMPLOYEE`
- Fields: `name`, `email`, `role`, `password`, `phone`, `nif`, `isActive`, `createdAt`, `deactivateAt`

### Repository

`EmployeeMongooseRepository` implements:

- `CreateEmployeeRepositoryPort` → `create`
- `FindEmployeeByEmailPort` → `findByEmail` (lean + `mapEmployeeDocument`)
- `FindEmployeesPort` → `findAll` (`find` + `sort` + `skip` + `limit` + `countDocuments` + `mapEmployeeReadModel`)

`findAll` sorts by `{ createdAt: -1, _id: -1 }` for stable pages.

Optional `search` builds a case-insensitive `$or` over `name`, `email`, `phone`, and `nif` (`$expr` + `$toString` because `nif` is stored as Number). Regex metacharacters in `search` are escaped.

### Mapper rules

- Document `_id` ↔ string `id`
- `phone`: string (or null) in Mongo ↔ string (or null) in snapshots / read models
- `nif`: number in Mongo ↔ string (or null) in snapshots / read models
- Defaults for missing `isActive` / dates when reading lean documents
- `mapEmployeeDocument` → `EmployeeModel.toCreate` (includes `password`) — write/lookup path
- `mapEmployeeReadModel` → `GetEmployeesItemDto` (**omits `password`**) — list path

When adding fields: update **schema → mapper → entity props / create props → DTOs** in that order of concern, and keep domain free of Mongoose types.

---

## Wiring (`employees.module.ts`)

Factory: `makeEmployeesModule({ connection, encrypter, authTokenMiddleware })`.

Composition order today:

1. `connection.model('Employee', EmployeeSchema)`
2. `EmployeeMongooseRepository`
3. `EmployeePoliciesService(repository)`
4. `CreateEmployeeUsecase(policies, encrypter, repository)`
5. `GetEmployeesQuery(repository)`
6. `CreateEmployeeController(createEmployee)`
7. `GetEmployeesController(getEmployees)`
8. `makeEmployeeRoutes({ createEmployeeController, getEmployeesController, authTokenMiddleware })`

Returns `{ createEmployeeController, getEmployeesController, createEmployee, getEmployees, router }`.

**Rule:** when adding a use case or query, wire it in this file; do not construct repositories inside controllers or use cases.

---

## Module checklist (extend employees)

Follow the global playbook in [`AGENTS.md`](../../../AGENTS.md). For this module specifically:

1. Domain / DTO / ports / use case or query / controller / route / repo as needed + specs
2. Wire in `employees.module.ts`
3. Update `src/client/employee.http` if HTTP surface changed
4. Update **this** `AGENT.md` (status, ports, HTTP, open decisions)

Example next command: `DeactivateEmployee` — entity already has `deactivate()`; add DTO, ports, use case, controller, route, wire, then update this file.

Never shortcut by calling the repository from the controller.

---

## Open decisions / known limitations

1. **Inactive email collision** — creating a new employee with the same email as an inactive one is blocked (`EmployeeInactiveError`). Reactivation vs. new account needs product/domain confirmation.
2. **Authorization** — routes require a valid token; role-based authorization (who may create/list) is not implemented yet.
3. **Error HTTP mapping** — create-path failures mostly go through `serverError`; list filters already map invalid `status`/`role` to `400`. Broader domain → HTTP status mapping may come later without moving that logic into domain.
4. **Employee “vacation” / leave status** — not modeled; list filter is only `status=active|inactive` (maps to `isActive`).

---

## Quick reference: file ownership

| Concern | Owner file |
|---------|------------|
| Business creation rules | `domain/entities/Employee.ts` |
| Role / write snapshot types | `domain/models/employee.model.ts` |
| Email availability | `domain/services/employee-policies.service.ts` |
| Create orchestration (command) | `application/usecases/create-employee.usecase.ts` |
| List orchestration (query) | `application/queries/get-employees.query.ts` |
| List read model DTOs | `application/dtos/get-employees.dto.ts` |
| Create HTTP validation / status | `presentation/controllers/create-employee.controller.ts` |
| List HTTP mapping / status | `presentation/controllers/get-employees.controller.ts` |
| Routes | `infrastructure/inbound/http/employee.routes.ts` |
| Mongo I/O | `infrastructure/outbound/persistence/employee-mongoose.repository.ts` |
| Document ↔ DTO mapping | `infrastructure/outbound/persistence/employee.mapper.ts` |
| DI | `employees.module.ts` |
| App mount | `src/app.ts` → `app.use('/api', employees.router)` |
| Offset pagination (shared) | `src/shared/application/pagination/pagination.dto.ts` |
