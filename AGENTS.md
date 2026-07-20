# grau-api — System Constitution

> Global guide for AI agents and developers.
> Application-wide rules live **here**. Per-module contracts live in `src/modules/<module>/AGENT.md`.

## Documentation hierarchy

| Document | Role |
|----------|------|
| [`AGENTS.md`](AGENTS.md) (this file) | Constitution: architecture, rules, patterns, conventions |
| [`docs/project-structure.md`](docs/project-structure.md) | Deep-dive: Mermaid diagrams and detailed folder tree |
| `src/modules/<module>/AGENT.md` | Living contract for that hexagon (routes, ports, DTOs, open decisions) |

**What to update when**

- Global pattern change (layers, naming, shared) → this file (+ `project-structure.md` if the tree/diagrams change).
- Module contract change → only that module’s `AGENT.md`.
- Do not treat these files as a changelog for cosmetic commits.

---

## Constitution

`grau-api` is an HTTP API built with **Express + TypeScript**, organized as **one hexagon per module** (Ports & Adapters). It does not use NestJS: the composition root is manual (`main.ts` / `app.ts` + `*.module.ts`).

- Each module under `src/modules/` is an independent hexagon.
- Cross-cutting code (VOs, BaseController, HTTP/bcrypt adapters, pagination) lives in `src/shared/`.
- Bootstrap and configs live in `src/main.ts`, `src/app.ts`, `src/configs/`.
- Manual REST Client requests live in `src/client/*.http`.

Reference module (canonical template): [`src/modules/employees`](src/modules/employees) — see [`AGENT.md`](src/modules/employees/AGENT.md).

---

## Architecture

### Dependency rule

```text
presentation / infrastructure  →  application  →  domain
domain ↛ application, presentation, infrastructure
```

### Hard rules

1. **Domain is pure** — no Express, Mongoose, bcrypt, env, or framework DI.
2. **Domain does not import `application`.**
3. Controllers in `presentation` are **framework-agnostic** (no Express imports).
4. Express lives only in `infrastructure/inbound/http` (+ shared `adaptRoute`).
5. Wiring belongs in the module’s `*.module.ts`; `app.ts` / `main.ts` only compose the app.
6. Other modules must **not** import a hexagon’s internal `domain`. Cross-module communication: ports/events.
7. Shared VOs (`Name`, `Email`, `Password`, `Nif`, `UniqueEntityId`, …) live in `@shared/domain`.
8. **Read models ≠ write snapshots** — list/get responses use application DTOs; do not reuse a persistence snapshot (e.g. `toCreate`) as HTTP output.

### CQRS (organizational)

Commands and queries share the same hexagon. Separation on the application side:

| Side | Folder | Example |
|------|--------|---------|
| Command (write) | `application/usecases/` | `create-*.usecase.ts` |
| Query (read) | `application/queries/` | `get-*.query.ts` |

Queries must **not** go through entity-create factories, write policies, or the encrypter unless there is an explicit domain need. Prefer a dedicated read port and a read-model DTO.

---

## Module layers

| Layer | Owns | May depend on |
|-------|------|----------------|
| `domain` | Entity, models, errors, domain services, domain ports | `@shared/domain` only |
| `application` | Use cases, queries, inbound/outbound ports, DTOs | `domain` + `@shared` |
| `presentation` | HTTP controllers (required-field validation, status) | `application` + `@shared/presentation` |
| `infrastructure/inbound` | Module Express routes | `presentation` + shared HTTP adapters |
| `infrastructure/outbound` | Schema, mapper, repository | `application` + `domain` + frameworks |
| `*.module.ts` | Wiring: instantiate adapters and inject into ports | module layers + shared |

### Where to put types

| Kind | Folder |
|------|--------|
| Use-case / query input/output DTO | `application/dtos/` |
| Domain concept / write snapshot | `domain/models/` |
| Port used by a domain service | `domain/ports/` |
| Driving (inbound) port | `application/ports/inbound/` |
| Driven (outbound) port | `application/ports/outbound/` |

---

## Conventions

### Naming

| Artifact | Pattern | Example |
|----------|---------|---------|
| Entity | `PascalCase.ts` | `Employee.ts` |
| Value object | `kebab-case.vo.ts` | `email.vo.ts` |
| Port | `kebab-case.port.ts` | `create-employee.port.ts` |
| DTO | `kebab-case.dto.ts` | `get-employees.dto.ts` |
| Use case (command) | `kebab-case.usecase.ts` | `create-employee.usecase.ts` |
| Query | `kebab-case.query.ts` | `get-employees.query.ts` |
| Controller | `kebab-case.controller.ts` | `get-employees.controller.ts` |
| Routes | `kebab-case.routes.ts` | `employee.routes.ts` |
| Repository | `kebab-case.repository.ts` | `employee-mongoose.repository.ts` |
| Schema / mapper | `kebab-case.schema.ts` / `.mapper.ts` | `employee.schema.ts` |
| Spec | co-located `*.spec.ts` | `create-employee.usecase.spec.ts` |
| Module factory | `*.module.ts` + `makeXModule` | `makeEmployeesModule` |

### Path aliases

Use aliases instead of `../../../` across packages (`tsconfig.json` / `jest.config.js`):

| Alias | Resolves to |
|-------|-------------|
| `@modules/*` | `./src/modules/*` |
| `@shared/*` | `./src/shared/*` |
| `@configs/*` / `@config/*` | `./src/configs/*` |

### Relevant shared

| Concern | Location |
|---------|----------|
| Entity base / DomainError / VOs | `@shared/domain` |
| EncrypterPort | `@shared/application/ports` |
| Offset pagination | `@shared/application/pagination` |
| BaseController / HttpResponse / helpers | `@shared/presentation` |
| `adaptRoute` (Express ↔ controller) | `@shared/infrastructure/adapters/http` |
| BcryptAdapter | `@shared/infrastructure/adapters/bcrypt` (injected in `app.ts`) |

### Persistence

When adding fields: **schema → mapper → entity props / DTOs**, keeping the domain free of Mongoose types.

---

## Testing

- Unit specs are **co-located** (`*.spec.ts` next to the production file). Do not create a parallel `__tests__` tree for modules.
- Prefer mocking ports at use-case / query / controller boundaries.
- Repository specs may use Mongo memory helpers from `@configs/database/mongoose`.
- Coverage (`jest.config.js`) excludes bootstrap, module wiring, HTTP routes/adapters, schemas, and configs — do not “fix coverage” by moving logic into those files.

---

## Playbooks

### New module (hexagon)

1. Create `src/modules/<name>/` with `domain`, `application`, `presentation`, `infrastructure`.
2. Implement Part 1 (usually a Create command) mirroring `employees`.
3. Factory `makeXModule` + mount the router in `app.ts`.
4. Add `src/client/<name>.http`.
5. After Part 1 stabilizes, create the module `AGENT.md` with the **current contract** (not on day zero).

### New command (write)

1. Domain — entity behavior / policies / errors if needed.
2. DTO under `application/dtos/`.
3. Inbound + outbound ports.
4. Use case under `application/usecases/` + spec.
5. Controller under `presentation/controllers/` + spec.
6. Register the route under `infrastructure/inbound/http`.
7. Extend repository/mapper/schema if the persistence API is insufficient + spec.
8. Wire in `*.module.ts`.
9. Update `.http` and the module `AGENT.md` if the contract changed.

### New query (read)

1. Filter DTO + read model (no sensitive write data, e.g. password).
2. Inbound + outbound read ports.
3. Query under `application/queries/` + spec.
4. Controller + route + module wiring.
5. Prefer a dedicated read port; do not reuse a write snapshot as HTTP output.
6. Offset pagination: compose `@shared/application/pagination`.

Never call the repository directly from the controller.

---

## Do / Don’t

| Do | Don’t |
|----|-------|
| Depend inward toward `domain` | Import Express/Mongoose in domain or use cases |
| Inject ports via constructor | Instantiate bcrypt/mongoose inside use cases |
| Put I/O DTOs in `application/dtos` | Put HTTP DTOs in `domain/models` |
| Put domain concepts/snapshots in `domain/models` | Reuse a write snapshot as list/get response |
| Put queries under `application/queries/` | Route reads through entity create/policies without need |
| Co-locate `*.spec.ts` | Create a parallel `__tests__` tree for the module |
| Use `@modules` / `@shared` aliases | Deep `../../../` imports across packages |
| Keep controllers Express-free | `import 'express'` in `presentation/` |
| Update the module AGENT.md on contract changes | Log every cosmetic rename in the docs |

---

## Quick references

| Resource | Path |
|----------|------|
| Visual structure / diagrams | [`docs/project-structure.md`](docs/project-structure.md) |
| Module template | [`src/modules/employees`](src/modules/employees) |
| Employees contract | [`src/modules/employees/AGENT.md`](src/modules/employees/AGENT.md) |
| Composition root | `src/app.ts`, `src/main.ts` |
