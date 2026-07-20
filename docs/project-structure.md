# Project structure — Ports & Adapters (Hexagonal)

Visual deep-dive of the `grau-api` architecture (diagrams + folder tree), based on the `employees` module.

## Documentation hierarchy

| Document | Role |
|----------|------|
| [`AGENTS.md`](../AGENTS.md) | Constitution for agents/devs: rules, patterns, conventions, playbooks |
| This file | Mermaid diagrams and detailed folder tree |
| `src/modules/<module>/AGENT.md` | Living contract for that hexagon |

Update this file when the **organization** of a module or the bootstrap changes (folders, diagrams).  
Global rules and naming → [`AGENTS.md`](../AGENTS.md). Employees contract → [`src/modules/employees/AGENT.md`](../src/modules/employees/AGENT.md).

## Principles

Summary (normative detail in [`AGENTS.md`](../AGENTS.md)):

- Each **module** is an independent hexagon (`employees` is the reference module).
- Dependency rule: `presentation / infrastructure → application → domain`.
- The **domain** does not know frameworks, HTTP, database, or DI — and does **not** import `application`.
- Cross-module communication: via **ports** / events — never import another module’s internal `domain`.
- Shared value objects live in `shared/domain`; use-case DTOs in `application/dtos`; domain concepts in `domain/models`.
- Wiring (ports → adapters) lives in `*.module.ts`; bootstrap (`main.ts` / `app.ts`) only composes the application.
- Each module owns its HTTP routing (`infrastructure/inbound/http`); `adaptRoute` stays in `shared`.

## Architecture diagram

```mermaid
flowchart TB
  subgraph Bootstrap["Bootstrap"]
    MAIN["main.ts"]
    APP["app.ts"]
    CFG["configs/envs + mongoose"]
  end

  subgraph Shared["shared"]
    ADAPT_ROUTE["adapters/http<br/>adaptRoute"]
    BCRYPT["adapters/bcrypt<br/>BcryptAdapter"]
    PRES_SHARED["presentation<br/>BaseController / HttpResponse"]
    ENC_PORT["application/ports<br/>EncrypterPort"]
    DOMAIN_SHARED["domain<br/>Entity / VOs"]
  end

  subgraph Employees["modules/employees"]
    MODULE["employees.module.ts<br/>Wiring / DI"]

    subgraph InboundHttp["infrastructure/inbound/http"]
      ROUTES["employee.routes"]
    end

    subgraph Presentation["presentation"]
      CTRL["CreateEmployeeController"]
    end

    subgraph Application["application"]
      DTOS["dtos<br/>CreateEmployeeDto"]
      IN_PORT["ports/inbound<br/>CreateEmployeePort"]
      OUT_PORT["ports/outbound<br/>CreateEmployeeRepositoryPort"]
      UC["CreateEmployeeUsecase"]
    end

    subgraph Domain["domain"]
      ENTITY["Employee"]
      MODEL["EmployeeModel<br/>Role / toCreate"]
      DOM_PORT["ports<br/>FindEmployeeByEmailPort"]
      POLICIES["EmployeePoliciesService"]
      ERRORS["employee.errors"]
    end

    subgraph Outbound["infrastructure/outbound/persistence"]
      REPO["EmployeeMongooseRepository"]
      SCHEMA["employee.schema"]
      MAPPER["employee.mapper"]
    end
  end

  MAIN --> CFG
  MAIN --> APP
  APP --> MODULE
  APP --> BCRYPT
  MODULE --> ROUTES
  MODULE --> CTRL
  MODULE --> UC
  MODULE --> REPO
  MODULE --> POLICIES

  ROUTES --> ADAPT_ROUTE
  ADAPT_ROUTE --> CTRL
  CTRL --> IN_PORT
  UC -.->|implements| IN_PORT
  UC --> DTOS
  UC --> POLICIES
  UC --> OUT_PORT
  UC --> ENC_PORT
  POLICIES --> DOM_PORT
  REPO -.->|implements| OUT_PORT
  REPO -.->|implements| DOM_PORT
  BCRYPT -.->|implements| ENC_PORT
  UC --> ENTITY
  ENTITY --> MODEL
  ENTITY --> DOMAIN_SHARED
  CTRL --> PRES_SHARED
  REPO --> SCHEMA
  REPO --> MAPPER
```

### Request flow (Create Employee)

```mermaid
sequenceDiagram
  participant Client
  participant Routes as employee.routes + adaptRoute
  participant Controller as CreateEmployeeController
  participant Port as CreateEmployeePort
  participant UseCase as CreateEmployeeUsecase
  participant Policies as EmployeePoliciesService
  participant Repo as EmployeeMongooseRepository
  participant Encrypter as BcryptAdapter
  participant Mongo as MongoDB

  Client->>Routes: POST /employee
  Routes->>Controller: handle(CreateEmployeeDto)
  Controller->>Port: execute(dto)
  Port->>UseCase: execute(dto)
  UseCase->>UseCase: Employee.create(...)
  UseCase->>Policies: ensureEmailIsAvailable(email)
  Policies->>Repo: findByEmail(email)
  Repo->>Mongo: findOne
  Mongo-->>Repo: document | null
  Repo-->>Policies: snapshot | null
  Policies-->>UseCase: ok | throw
  UseCase->>Encrypter: encrypt(password)
  Encrypter-->>UseCase: hash
  UseCase->>Repo: create(toCreate)
  Repo->>Mongo: insert
  Mongo-->>Repo: id
  Repo-->>UseCase: CreateEmployeeResultDto
  UseCase-->>Controller: CreateEmployeeResultDto
  Controller-->>Routes: 201 { data }
  Routes-->>Client: JSON response
```

## Official structure

```text
grau-api/
├── src/
│   ├── main.ts                                         # entrypoint (env, DB, listen)
│   ├── app.ts                                          # Express + modules composition
│   │
│   ├── configs/
│   │   ├── envs/
│   │   │   └── index.ts                                # DATABASE_HOST, PORT
│   │   └── database/mongoose/
│   │       ├── database-connection.ts                  # connectDatabase / disconnectDatabase
│   │       ├── test-setup-mongoose-menory.ts           # MongoMemoryServer (tests)
│   │       └── testables.ts                            # chainable Mongoose mocks
│   │
│   ├── modules/
│   │   └── employees/                                  # module hexagon
│   │       ├── AGENT.md                                # living module contract
│   │       ├── domain/                                 # 🔒 pure business rules
│   │       │   ├── entities/
│   │       │   │   ├── Employee.ts
│   │       │   │   └── employee.spec.ts
│   │       │   ├── models/
│   │       │   │   ├── employee.model.ts               # Role, toCreate, isRole
│   │       │   │   └── employee.model.spec.ts
│   │       │   ├── ports/
│   │       │   │   └── find-employee-by-email.port.ts  # port used by domain service
│   │       │   ├── errors/
│   │       │   │   └── employee.errors.ts
│   │       │   └── services/
│   │       │       ├── employee-policies.service.ts
│   │       │       └── employee-policies.service.spec.ts
│   │       │
│   │       ├── application/                            # use cases + ports + DTOs
│   │       │   ├── dtos/
│   │       │   │   ├── create-employee.dto.ts          # CreateEmployeeDto / ResultDto
│   │       │   │   └── create-employee.dto.spec.ts
│   │       │   ├── ports/
│   │       │   │   ├── inbound/                       # driving ports
│   │       │   │   │   └── create-employee.port.ts
│   │       │   │   └── outbound/                      # driven ports
│   │       │   │       └── create-employee-repository.port.ts
│   │       │   └── usecases/
│   │       │       ├── create-employee.usecase.ts      # implements CreateEmployeePort
│   │       │       └── create-employee.usecase.spec.ts
│   │       │
│   │       ├── presentation/                           # controllers (HTTP, no Express)
│   │       │   └── controllers/
│   │       │       ├── create-employee.controller.ts   # depends on CreateEmployeePort
│   │       │       └── create-employee.controller.spec.ts
│   │       │
│   │       ├── infrastructure/
│   │       │   ├── inbound/http/                      # driving adapter (Express)
│   │       │   │   └── employee.routes.ts
│   │       │   └── outbound/persistence/              # driven adapter (Mongo)
│   │       │       ├── employee.schema.ts
│   │       │       ├── employee.mapper.ts
│   │       │       ├── employee-mongoose.repository.ts
│   │       │       └── employee-mongoose.repository.spec.ts
│   │       │
│   │       └── employees.module.ts                     # wiring / DI
│   │
│   ├── shared/                                         # cross-cutting (no employee rules)
│   │   ├── domain/
│   │   │   ├── entity/
│   │   │   │   ├── entity.ts
│   │   │   │   └── entity.spec.ts
│   │   │   ├── errors/
│   │   │   │   └── domain.error.ts
│   │   │   └── value-object/
│   │   │       ├── value-object.ts
│   │   │       ├── value-object.spec.ts
│   │   │       ├── index.ts
│   │   │       ├── id/unique-entity-id.vo.ts
│   │   │       ├── name/name.vo.ts
│   │   │       ├── email/email.vo.ts
│   │   │       ├── password/password.vo.ts
│   │   │       └── nif/nif.vo.ts
│   │   ├── application/
│   │   │   └── ports/
│   │   │       └── encrypter.port.ts
│   │   ├── presentation/
│   │   │   ├── protocols/
│   │   │   │   ├── base-controller.ts
│   │   │   │   └── http-response.ts
│   │   │   ├── helpers/
│   │   │   │   └── http-helper.ts
│   │   │   └── errors/
│   │   │       ├── presentation.error.ts
│   │   │       └── missing-param.error.ts
│   │   └── infrastructure/
│   │       └── adapters/
│   │           ├── http/
│   │           │   └── express-route.adapter.ts        # Express req/res ↔ controller
│   │           └── bcrypt/
│   │               ├── bcrypt.adapter.ts               # implements EncrypterPort
│   │               └── bcrypt.adapter.spec.ts
│   │
│   └── client/
│       └── employee.http                               # REST Client requests
│
├── docs/
│   └── project-structure.md                            # diagrams + tree (this file)
│
├── AGENTS.md                                           # global constitution (agents/devs)
├── docker-compose.yml                                  # local MongoDB
├── .env
├── jest.config.js
├── lefthook.yml
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

## Layers, types, aliases, and naming

Normative tables (layers, where to put types, path aliases, naming, testing, Do/Don’t) → [`AGENTS.md`](../AGENTS.md).

## Structure notes

- Controllers in `presentation` do not import Express; `adaptRoute` bridges the gap.
- Module HTTP routes live in `infrastructure/inbound/http` and are mounted by `employees.module.ts`.
- `EncrypterPort` is shared; the concrete implementation (`BcryptAdapter`) is injected at the composition root (`app.ts`).
- Current employees hexagon contract (ports, DTOs, HTTP) → [`src/modules/employees/AGENT.md`](../src/modules/employees/AGENT.md).
