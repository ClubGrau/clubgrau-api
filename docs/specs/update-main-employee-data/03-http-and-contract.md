# Spec: Slice 3 — HTTP + contract (`PATCH /employee/:id/main-data`)

> Public surface, wiring, and living contract.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-usecase.md`](./02-usecase.md).  
> Design §9 / §11 / §12. PRD HTTP table.  
> Jira: [KAN-24](https://paulodevmais.atlassian.net/browse/KAN-24).  
> Next: none (Auth JWT revoke and lifecycle Actor login-capable stay follow-ups).

## Responsibility (this spec only)

Ship `PATCH /api/employee/:id/main-data` through the hexagon: request shape → controller → route → module → `.http` → `AGENT.md`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md)–[`02`](./02-usecase.md) | Policy, persist, use case already shipped |
| **This file** | HTTP gate, error map, wiring, contract docs |

## When to use this spec

Follow the constitution **new command** playbook for presentation + inbound HTTP + module. Reuse `authTokenMiddleware`, `requireRoles('ADMIN', 'MANAGER')`, and `adaptRoute`. Do not add Get-by-id. Do not revoke JWTs.

| Artifact | This slice? |
|----------|-------------|
| `UpdateMainEmployeeDataRequest` | Yes |
| Controller + spec | Yes |
| `PATCH /employee/:id/main-data` + `requireRoles` | Yes |
| `makeEmployeesModule` wiring | Yes |
| `src/client/employee.http` sample | Yes |
| Living `AGENT.md` (delivered table, ports, HTTP, directory map) | Yes |
| Get-by-id / personal / professional | **No** |
| Lifecycle Actor → login-capable | **No** |
| Create occupancy HTTP (`500` today) | **No** — only this controller maps occupancy → `409` |

**Prompt sketch for the agent:**

> Implement slice 3 of Update Main Employee Data following [`docs/specs/update-main-employee-data/03-http-and-contract.md`](./03-http-and-contract.md).  
> `PATCH /api/employee/:id/main-data` with `authTokenMiddleware` + `requireRoles('ADMIN','MANAGER')`. Sparse presence; `status`/`password` → `400`; occupancy → `409`; `EmployeeMainDataForbiddenError` → `403`.  
> Do not trust body `id` / `actorId`. Update `employee.http` and `AGENT.md`. Do not add Get-by-id or revoke JWTs.

## HTTP surface

```http
PATCH /api/employee/:id/main-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{ "name": "...", "email": "...", "phone": "...", "username": "..." }
```

`:id` is the Target. Do not send `id` or `actorId` in the body. `adaptRoute` merges body then **params** then stamps `actorId` last — path `id` wins over a forged body `id`; JWT wins over a forged `actorId`.

```ts
router.patch(
  '/employee/:id/main-data',
  authTokenMiddleware,
  requiredRoleEmployee, // requireRoles('ADMIN', 'MANAGER')
  adaptRoute(updateMainEmployeeDataController),
)
```

Success: `200` `{ data: { id } }` via `ok(...)`.

| Situation | HTTP |
|-----------|------|
| No Main Data key / only unknown keys | `400` |
| `name` / `email` / `phone` present and blank / whitespace / `null` | `400` |
| Invalid email / phone / name VO | `400` |
| `status` or `password` key present | `400` `InvalidParamError` |
| Target not found | `400` |
| Actor missing, not found, or not login-capable | `401` |
| `EMPLOYEE` token | `403` at `requireRoles` (and/or domain) |
| MANAGER on MANAGER / ADMIN / self | `403` |
| Target Removed | `409` |
| Email occupied (`ACTIVE` or `INACTIVE` / `VACATION`) | `409` |
| Unexpected (including 0-document `$set`) | `500` |

Unknown keys (`role`, `nif`, `foo`) are ignored. Empty / only-unknown body is still `400`.

## Request type — `presentation/http/update-main-employee-data.request.ts`

```ts
export type UpdateMainEmployeeDataRequest = {
  id?: string
  actorId?: string
  name?: string
  email?: string
  phone?: string
  username?: string | null
  status?: unknown
  password?: unknown
}
```

Raw HTTP shape (pre-validation). Do not reuse the typed application DTO as this type.

## Controller (normative)

Express-free. Inject inbound port only.

**Presence** after `adaptRoute` is `'name' in request` (JSON `null` is present). Do **not** treat path `id`, stamped `actorId`, or `actorRole` as Main Data.

Order:

1. If `'status' in request` or `'password' in request` → `400` `InvalidParamError` (`status` or `password`). Do not call the port.
2. Collect present Main Data keys (`name` / `email` / `phone` / `username`).
3. None present → `400` (empty / only-unknown). Do not call the port.
4. `name` / `email` / `phone` present and (`null` / `''` / whitespace) → `400` `InvalidParamError` or `MissingParamError` for that field. Do not forward. Do not treat as clear.
5. `username` present + `""` / whitespace / `null` → forward `null` (clear).
6. Forward `{ actorId: String(request.actorId ?? ''), id: String(request.id), ...present normalized Main Data }`. Do not require `actorId` as a missing-param.
7. Success → `ok({ id })`.
8. `catch` map:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmployeeMainDataForbiddenError` | `forbidden` (`403`) |
| `EmployeeAlreadyRemovedError` | `conflict` (`409`) |
| `EmployeeAlreadyExistsError` | `conflict` (`409`) |
| `EmployeeInactiveError` | `conflict` (`409`) |
| `EmployeeNotFoundError` | `badRequest` (`400`) |
| `InvalidEmailError` / `InvalidNameError` / `InvalidPhoneFormatError` (and siblings) | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

Do **not** map `EmployeeLifecycleForbiddenError` here. Create’s occupancy still goes through `serverError` — do not “fix” Create in this slice.

## Module factory

Extend `makeEmployeesModule` (same repository instance):

```ts
const mainDataPolicy = new EmployeeMainDataPolicy()

const updateMainEmployeeData = new UpdateMainEmployeeDataUsecase(
  employeeRepository,
  employeePoliciesService,
  mainDataPolicy,
  employeeRepository,
)

const updateMainEmployeeDataController = new UpdateMainEmployeeDataController(
  updateMainEmployeeData,
)
```

Pass the controller into `makeEmployeeRoutes`. Return it from the module if the existing return shape lists controllers; stay consistent.

Do not construct the repository inside the controller or use case. `app.ts` unchanged (middleware already injected).

## `.http`

Add samples under `src/client/employee.http`. No `actorId` / body `id`. Comment that the Target is `:id` and the Actor comes from the Bearer token.

Minimum samples:

- ADMIN + `{ "name": "João Silva" }`
- `{ "username": "" }` (clear)
- Comment: `status` / `password` on this body → `400`; Status stays `POST /employee/update-status`

## `AGENT.md` (living contract)

Update in place — not a changelog dump:

- Delivered table: Update Main Employee Data → `PATCH /api/employee/:id/main-data`
- Directory map: new DTO / ports / use case / request / controller / policy files
- Domain: `changeUsername`; `EmployeeMainDataPolicy`; `EmployeeMainDataForbiddenError`
- Application section for this command (ports, DTO, flow)
- HTTP: route line + error table + sequence
- Persistence: repository implements `updateMainData`
- Wiring list: construct policy + use case + controller
- Open decisions: leftover JWT after email change (Auth sibling); Create occupancy HTTP still `500`; lifecycle Actor still `ACTIVE`-only
- Future work: drop “update other fields” as the Main Data hole; keep Get-by-id / personal / professional

## Files

| File | Action |
|------|--------|
| `presentation/http/update-main-employee-data.request.ts` | Create |
| `presentation/controllers/update-main-employee-data.controller.ts` + `*.spec.ts` | Create |
| `infrastructure/inbound/http/employee.routes.ts` | `PATCH` + `requiredRoleEmployee` |
| `employees.module.ts` | Wire policy + use case + controller |
| `src/client/employee.http` | Samples |
| `src/modules/employees/AGENT.md` | Living contract |
| Policy / use case / schema | Do not re-implement |

## Spec expectations (`update-main-employee-data.controller.spec.ts`)

Stub inbound port. Do not test Express middleware here (`requireRoles` / `adaptRoute` already have their own specs).

| `it(...)` | Assert |
|-----------|--------|
| `{}` / only `{ role: 'ADMIN' }` | `400`; port not called |
| `{ name: '' }` / `{ email: '   ' }` / `{ phone: null }` | `400`; port not called |
| `{ name: 'X', status: 'INACTIVE' }` | `400` `Invalid param status`; port not called |
| `{ password: '...' }` | `400`; port not called |
| `{ username: '' }` / `{ username: null }` | port called with `username: null` |
| `{ name: 'João Silva' }` | port `{ actorId, id, name }`; no email/phone/username |
| forwards path `id` and stamped `actorId` | body `id` / `actorId` must not win — assert the values the controller reads from the flattened request (`id` / `actorId` already overwritten by the adapter in production) |
| `ActorAuthenticationFailedError` | `401` |
| `EmployeeMainDataForbiddenError` | `403` |
| `EmployeeAlreadyRemovedError` / occupancy errors | `409` |
| `EmployeeNotFoundError` / VO errors | `400` |
| generic throw | `500` |
| success | `200` `{ data: { id } }` |

## Checklist (agent)

- [ ] Route uses `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`
- [ ] Presence ignores `id` / `actorId` / `actorRole`
- [ ] `status` / `password` present → `400`; no write
- [ ] Blank name/email/phone → `400`; blank username → clear
- [ ] HTTP map matches the table (`403` is `EmployeeMainDataForbiddenError`)
- [ ] Occupancy → `409` on **this** controller only
- [ ] Module injects `EmployeeMainDataPolicy` (no ports)
- [ ] `.http` has a Main Data sample without `actorId`
- [ ] `AGENT.md` lists the command, ports, route, leftover JWT
- [ ] Co-located controller spec passes
- [ ] No Get-by-id; no lifecycle Actor change; no Create occupancy remap

## Out of scope

- `GET /api/employee/:id`
- Personal / professional sections
- Revoking Session Tokens on email change
- Changing `EmployeeLifecyclePolicy` Actor to login-capable
- Aligning Create occupancy HTTP to `409`

## Acceptance criteria

- [ ] `PATCH /api/employee/:id/main-data` with ADMIN + `{ "name": "João Silva" }` → `200 { data: { id } }`
- [ ] `{ "username": "" }` → `200`; username `null`
- [ ] `{ "phone": "" }` or `{ "name": "" }` → `400`; no write
- [ ] `{}` or `{ "role": "ADMIN" }` → `400`
- [ ] `{ "name": "X", "status": "INACTIVE" }` or `{ "password": "..." }` → `400`; no write
- [ ] EMPLOYEE token → `403` (middleware)
- [ ] MANAGER + Target MANAGER / ADMIN / self → `403`
- [ ] Forged body `actorId` overwritten; forged body `id` loses to `:id`
- [ ] Occupancy collisions → `409`
- [ ] Target Removed → `409`
- [ ] `AGENT.md` lists the new command; `employee.http` has a Main Data sample

## Reference map

| Concern | Look at |
|---------|---------|
| Adapter stamp order | `src/shared/infrastructure/adapters/http/express-route.adapter.ts` |
| Role gate | `makeRequireRoles` + existing `requiredRoleEmployee` |
| Sibling HTTP map | `presentation/controllers/update-employee-status.controller.ts` |
| Routes today | `infrastructure/inbound/http/employee.routes.ts` |
| Living contract | `src/modules/employees/AGENT.md` |
