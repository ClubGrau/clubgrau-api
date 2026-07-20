# Employees Module — Agent Guide

> Living guidance for AI agents and developers working on `src/modules/employees`.
> Companion architecture overview (Portuguese): [`docs/project-structure.md`](../../../docs/project-structure.md).

## Purpose of this document

This file captures the **current contract** of the employees hexagon after **Part 1** (Create Employee) and **Part 2** (Get Employees query). Use it to:

- Extend the module without breaking hexagonal boundaries
- Place new types, ports, and files in the correct layer
- Preserve existing naming, dependency, and testing conventions

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** this document when any of the following change:

| Change type | Examples |
|-------------|----------|
| Architecture / layering | New folder, dependency direction change, wiring pattern |
| Public HTTP surface | New route, method, path, or response shape |
| Domain invariants | Role rules, activation policy, email uniqueness rules |
| Ports / DTOs | New inbound/outbound port, DTO fields, return contracts |
| Persistence mapping | Schema fields, mapper rules, repository responsibilities |
| Open decisions | Resolved TODOs, new known limitations |
| Conventions | Naming, test placement, shared-vs-module ownership |

After a meaningful change, update the relevant section(s) in place. Keep history out of this file unless a decision needs an explicit “why we chose X” note.

---

## Module status

### Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| Create employee (command) | Done | `POST /employee` |
| List employees (query) | Done | `GET /employee` |
| Email uniqueness policy | Done | `EmployeePoliciesService.ensureEmailIsAvailable` |
| Password confirmation | Done | `CreateEmployeeUsecase` |
| Password hashing | Done | `EncrypterPort` → `BcryptAdapter` (injected from `app.ts`) |
| Mongo persistence | Done | `EmployeeMongooseRepository` |
| Auth token on employee routes | Done | `authTokenMiddleware` on `GET` / `POST /employee` |
| Module HTTP ownership | Done | `infrastructure/inbound/http/employee.routes.ts` |
| Composition root wiring | Done | `employees.module.ts` + `app.ts` |

### CQRS (partial)

Commands and queries share the same hexagon. Separation today is **organizational** on the application side:

| Side | Location | Example |
|------|----------|---------|
| Command (write) | `application/usecases/` | `CreateEmployeeUsecase` |
| Query (read) | `application/queries/` | `GetEmployeesQuery` |

Queries do **not** call `Employee.create`, policies, or encrypter. They use a dedicated read model DTO (no `password`) and a dedicated outbound read port.

### Future work

- Get employee by id / update / deactivate / reactivate
- Authorization (who may create/list employees) beyond token presence
- Phone validation (see TODO in `CreateEmployeeUsecase`)
- Explicit reactivation flow for inactive employees with the same email
- Cross-module events / integration beyond this hexagon
- Coerce query-string filters (`isActive=true` arrives as string via `adaptRoute`)

---

## Architecture principles

Hexagonal (Ports & Adapters). Dependency rule:

```text
presentation / infrastructure  →  application  →  domain
domain ↛ application, presentation, infrastructure
```

Hard rules:

1. **Domain is pure** — no Express, Mongoose, bcrypt, env, or Nest-style DI.
2. **Domain does not import `application`.**
3. Controllers in `presentation` are **framework-agnostic** (no Express imports).
4. Express lives only in `infrastructure/inbound/http` (+ shared `adaptRoute`).
5. Wiring belongs in `employees.module.ts`; `app.ts` / `main.ts` only compose the app.
6. Other modules must **not** import this module’s internal `domain`. Cross-module communication goes through ports/events (when introduced).
7. Shared VOs (`Name`, `Email`, `Password`, `Nif`, `UniqueEntityId`) live in `@shared/domain`.
8. **Read models ≠ write snapshots** — list/get responses use application DTOs without `password`; do not reuse `EmployeeModel.toCreate` as HTTP output.

---

## Directory map

```text
src/modules/employees/
├── AGENT.md                          # this file
├── employees.module.ts               # composition / DI for the hexagon
│
├── domain/                           # business rules (pure)
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
├── application/                      # use cases / queries + ports + DTOs
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
│   ├── usecases/                     # commands (write)
│   │   ├── create-employee.usecase.ts
│   │   └── create-employee.usecase.spec.ts
│   └── queries/                      # queries (read)
│       ├── get-employees.query.ts
│       └── get-employees.query.spec.ts
│
├── presentation/                     # HTTP controllers (no Express)
│   └── controllers/
│       ├── create-employee.controller.ts
│       ├── create-employee.controller.spec.ts
│       ├── get-employees.controller.ts
│       └── get-employees.controller.spec.ts
│
└── infrastructure/
    ├── inbound/http/
    │   └── employee.routes.ts        # Express Router for this module
    └── outbound/persistence/
        ├── employee.schema.ts
        ├── employee.mapper.ts        # mapEmployeeDocument + mapEmployeeReadModel
        ├── employee-mongoose.repository.ts
        └── employee-mongoose.repository.spec.ts
```

Related outside the module:

| Path | Role |
|------|------|
| `src/app.ts` | Injects `connection` + `BcryptAdapter` + `authTokenMiddleware`, mounts `/employee` |
| `src/shared/**` | Entity base, VOs, EncrypterPort, BaseController, adaptRoute |
| `src/client/employee.http` | Manual REST Client requests |
| `docs/project-structure.md` | Repo-wide hexagonal structure (PT) |

---

## Layer responsibilities

| Layer | Owns | May depend on |
|-------|------|----------------|
| `domain` | Entity, model concepts, domain errors, domain services, domain ports | `@shared/domain` only |
| `application` | Use cases, queries, inbound/outbound ports, use-case DTOs | `domain` + `@shared` |
| `presentation` | Controllers (validate required fields, map to HTTP) | `application` + `@shared/presentation` |
| `infrastructure/inbound` | Express routes | `presentation` + shared HTTP adapters |
| `infrastructure/outbound` | Mongoose schema, mapper, repository | `application` + `domain` + frameworks |
| `employees.module.ts` | Instantiates adapters and binds ports | all module layers + shared adapters |

### Where to put types

| Kind | Location | Example |
|------|----------|---------|
| Use-case / query I/O DTO | `application/dtos/` | `CreateEmployeeDto`, `GetEmployeesItemDto` |
| Domain concept / persistence snapshot | `domain/models/` | `EmployeeModel.Role`, `EmployeeModel.toCreate` |
| Port used by a domain service | `domain/ports/` | `FindEmployeeByEmailPort` |
| Driving (inbound) port | `application/ports/inbound/` | `CreateEmployeePort`, `GetEmployeesPort` |
| Driven (outbound) port | `application/ports/outbound/` | `CreateEmployeeRepositoryPort`, `FindEmployeesPort` |

---

## Naming conventions

| Artifact | Pattern | Example |
|----------|---------|---------|
| Entity | `PascalCase.ts` | `Employee.ts` |
| Port | `kebab-case.port.ts` | `get-employees.port.ts` |
| DTO | `kebab-case.dto.ts` | `get-employees.dto.ts` |
| Use case (command) | `kebab-case.usecase.ts` | `create-employee.usecase.ts` |
| Query | `kebab-case.query.ts` | `get-employees.query.ts` |
| Controller | `kebab-case.controller.ts` | `get-employees.controller.ts` |
| Routes | `kebab-case.routes.ts` | `employee.routes.ts` |
| Repository | `kebab-case.repository.ts` | `employee-mongoose.repository.ts` |
| Schema / mapper | `kebab-case.schema.ts` / `.mapper.ts` | `employee.schema.ts` |
| Spec | co-located `*.spec.ts` | `get-employees.query.spec.ts` |
| Module factory | `*.module.ts` + `makeXModule` | `makeEmployeesModule` |

Path aliases (must be used instead of deep relative imports across packages):

| Alias | Resolves to |
|-------|-------------|
| `@modules/*` | `./src/modules/*` |
| `@shared/*` | `./src/shared/*` |
| `@configs/*` / `@config/*` | `./src/configs/*` |

---

## Domain model

### `Employee` entity

Factory methods:

- `Employee.create(CreateEmployeeProps)` — new employee; validates role; builds VOs; defaults `isActive=true`, `createdAt=now`, `deactivateAt=null`.
- `Employee.reconstitute(ReconstituteEmployeeProps)` — rebuild from persistence (already-validated VOs + id).

Behavior already on the entity (for future use cases):

- `activate()` / `deactivate()`
- `changePassword`, `changeRole`, `changeName`, `changeEmail`, `assignNif`

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

**Known TODO in code:** phone validation before create (should be injected as a dependency when introduced).

---

## Application: Get Employees (query)

### Ports

```ts
// inbound
interface GetEmployeesPort {
  execute(filters: GetEmployeesDto): Promise<GetEmployeesItemDto[]>;
}

// outbound
interface FindEmployeesPort {
  findAll(filters: GetEmployeesDto): Promise<GetEmployeesItemDto[]>;
}
```

### DTOs

```ts
interface GetEmployeesDto {
  isActive?: boolean;
  role?: EmployeeModel.Role;
}

interface GetEmployeesItemDto {
  id: string;
  name: string;
  email: string;
  role: EmployeeModel.Role;
  nif: string | null;
  isActive: boolean;
  createdAt: Date;
  deactivateAt: Date | null;
}

interface GetEmployeesResultDto {
  employees: GetEmployeesItemDto[];
}
```

`GetEmployeesResultDto` is the HTTP success payload shape (`{ employees }`). The inbound port returns the array; the controller wraps it.

### Query flow (`GetEmployeesQuery`)

1. Call `FindEmployeesPort.findAll(filters)`
2. Return `GetEmployeesItemDto[]`

No domain entity creation, no policies, no encrypter.

---

## Presentation & HTTP

### Controllers

`CreateEmployeeController` extends `BaseController`:

- Required fields: `name`, `email`, `password`, `passwordConfirmation`
- Missing field → `400` + `MissingParamError`
- Success → `201` + `{ id }` via `created(...)`
- Unexpected errors → `serverError(...)`

`role` / `nif` are passed through when present; domain validates role.

`GetEmployeesController` extends `BaseController`:

- No required fields
- Forwards optional filters: `isActive`, `role`
- Success → `200` + `{ data: { employees } }` via `ok(...)`
- Unexpected errors → `serverError(...)`

### Routes

```ts
// employee.routes.ts
router.get('/', authTokenMiddleware, adaptRoute(getEmployeesController));
router.post('/', authTokenMiddleware, adaptRoute(createEmployeeController));
```

Mounted in `app.ts` as:

```text
GET  /employee
POST /employee
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
      → FindEmployeesPort.findAll
  → 200 { data: { employees: [...] } }
```

---

## Persistence

### Schema highlights

- Unique index on `email`
- `role` enum: `ADMIN | MANAGER | EMPLOYEE`
- Fields: `name`, `email`, `role`, `password`, `nif`, `isActive`, `createdAt`, `deactivateAt`

### Repository

`EmployeeMongooseRepository` implements:

- `CreateEmployeeRepositoryPort` → `create`
- `FindEmployeeByEmailPort` → `findByEmail` (lean + `mapEmployeeDocument`)
- `FindEmployeesPort` → `findAll` (lean + `mapEmployeeReadModel`; optional `isActive` / `role` filters)

### Mapper rules

- Document `_id` ↔ string `id`
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

**Rule for agents:** when adding a use case or query, wire it in this file; do not construct repositories inside controllers or use cases.

---

## Testing conventions

- Unit specs are **co-located** (`*.spec.ts` next to production file).
- Prefer mocking ports at use-case / query / controller boundaries.
- Repository specs may use Mongo memory helpers from `@configs/database/mongoose`.
- Coverage config excludes bootstrap, module wiring, HTTP routes/adapters, schemas, and configs — do not “fix coverage” by moving logic into those excluded files.

Suggested checklist for a new command/query:

1. Domain changes (entity/model/errors/policies) + specs — skip for pure queries when not needed
2. DTO + inbound/outbound ports
3. Use case **or** query + spec
4. Controller + spec
5. Route registration
6. Repository method(s) + mapper/schema if needed + spec
7. Wire in `employees.module.ts`
8. Update `src/client/employee.http` if HTTP surface changed
9. Update **this** `AGENT.md` if architecture/contracts changed

---

## How to add a new use case / query (playbook)

Example command: `DeactivateEmployee`.

1. **Domain** — ensure entity behavior exists (`deactivate()` already does); add policy/errors if needed.
2. **Application DTO** — `application/dtos/deactivate-employee.dto.ts`.
3. **Ports** — inbound `DeactivateEmployeePort`; outbound port(s) as needed (e.g. find by id + save).
4. **Use case** — `application/usecases/deactivate-employee.usecase.ts` implementing the inbound port.
5. **Presentation** — controller under `presentation/controllers/`.
6. **Infrastructure inbound** — register route in `employee.routes.ts` (extend `EmployeeRoutesDependencies`).
7. **Infrastructure outbound** — extend repository/mapper/schema only if persistence API is insufficient.
8. **Module** — construct and inject in `makeEmployeesModule`.
9. **Docs** — update this AGENT.md sections: status table, ports, HTTP surface.

Example query: place under `application/queries/`, return a read model DTO (never `EmployeeModel.toCreate` for HTTP), and prefer a dedicated outbound read port.

Never shortcut by calling the repository from the controller.

---

## Do / Don’t

| Do | Don’t |
|----|-------|
| Depend inward toward `domain` | Import Express/Mongoose inside domain or use cases |
| Inject ports via constructor | Instantiate bcrypt/mongoose inside use cases |
| Put use-case I/O in `application/dtos` | Put HTTP DTOs inside `domain/models` |
| Put `Role` / write snapshots in `domain/models` | Reuse `toCreate` as list/get HTTP output |
| Put queries under `application/queries/` | Put read-only flows through create/entity policies unnecessarily |
| Co-locate `*.spec.ts` | Create a parallel `__tests__` tree for this module |
| Use `@modules` / `@shared` aliases | Deep `../../../` imports across packages |
| Keep controllers framework-free | Import `express` in `presentation/` |
| Update AGENT.md on contract changes | Log every commit or cosmetic rename here |

---

## Open decisions / known limitations

1. **Inactive email collision** — creating a new employee with the same email as an inactive one is blocked (`EmployeeInactiveError`). Reactivation vs. new account needs product/domain confirmation.
2. **Phone validation** — TODO in `CreateEmployeeUsecase`; plan to inject as a dependency.
3. **Authorization** — routes require a valid token; role-based authorization (who may create/list) is not implemented yet.
4. **NIF in HTTP create** — supported on DTO/entity; controller currently does not forward `nif` from the request (gap to close if NIF is required at API boundary).
5. **Error HTTP mapping** — controller maps most failures through `serverError`; finer-grained domain → HTTP status mapping may be introduced later without moving that logic into domain.
6. **Query-string filter coercion** — `adaptRoute` merges `req.query` as strings; `isActive=true` is not coerced to boolean yet. Filters work cleanly when passed as typed values (e.g. tests); HTTP query params may need parsing in the controller later.

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
| App mount | `src/app.ts` → `app.use('/employee', employees.router)` |
