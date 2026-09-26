# Spec: Slice 3 — HTTP + contract (`PATCH /employee/:id/professional-data`)

> Public surface, wiring, and living contract.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-usecase.md`](./02-usecase.md).  
> Design §9 / §11 / §12 / §18. PRD HTTP table.  
> Jira: TBD.  
> Next: none (Get-by-id, JWT revoke, lifecycle Actor login-capable, and `employmentId` on Create stay follow-ups).

## Responsibility (this spec only)

Ship `PATCH /api/employee/:id/professional-data` through the hexagon: request shape → controller → route → module → `.http` → `AGENT.md`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md)–[`02`](./02-usecase.md) | Policy, patch service, persist, use case already shipped |
| **This file** | HTTP gate, presence, error map, wiring, contract docs |

## When to use this spec

Follow the constitution **new command** playbook for presentation + inbound HTTP + module. Reuse `authTokenMiddleware`, `requireRoles('ADMIN', 'MANAGER')`, and `adaptRoute`. Do not add Get-by-id. Do not revoke JWTs. Do not change `POST /api/employee/update-status`. Do not add a Role intent to `EmployeeLifecyclePolicy`.

| Artifact | This slice? |
|----------|-------------|
| `UpdateProfessionalEmployeeDataRequest` | Yes |
| Controller + spec | Yes |
| `PATCH /employee/:id/professional-data` + `requireRoles` | Yes |
| `makeEmployeesModule` wiring | Yes |
| `src/client/employee.http` sample | Yes |
| Living `AGENT.md` (delivered table, ports, HTTP, directory map) | Yes |
| Get-by-id / Main / Personal / self-service | **No** |
| Lifecycle Actor → login-capable / `countActiveAdmins` widen | **No** |
| Writing `employmentId` | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of Update Professional Employee Data following [`docs/specs/update-professional-employee-data/03-http-and-contract.md`](./03-http-and-contract.md).  
> `PATCH /api/employee/:id/professional-data` with `authTokenMiddleware` + `requireRoles('ADMIN','MANAGER')`. Sparse presence. `password` → `400`. `employmentId` ignored. Map `EmployeeProfessionalDataForbiddenError` → `403`. Map `EmployeeLifecycleForbiddenError` → `403`. Map `LastAdminProtectedError` → `409`.  
> Do not trust body `id` / `actorId`. Leave `POST /update-status` unchanged. Update `employee.http` and `AGENT.md`.

## HTTP surface

```http
PATCH /api/employee/:id/professional-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{ "jobTitle": "Barbeiro", "role": "EMPLOYEE", "status": "ACTIVE" }
```

`:id` is the Target. Do not send `id` or `actorId` in the body. `adaptRoute` merges body then **params** then stamps `actorId` last — path `id` wins over a forged body `id`; JWT wins over a forged `actorId`.

```ts
router.patch(
  '/employee/:id/professional-data',
  authTokenMiddleware,
  requiredRoleEmployee, // requireRoles('ADMIN', 'MANAGER')
  adaptRoute(updateProfessionalEmployeeDataController),
)
```

Success: `200` `{ data: { id } }` via `ok(...)`.

| Situation | HTTP |
|-----------|------|
| No `jobTitle` / `role` / `status` / only unknown keys / only `employmentId` | `400` |
| `password` key present | `400` `InvalidParamError('password')` |
| `role` / `status` present and null / blank / whitespace | `400` |
| Invalid `role` (not in enum) | `400` |
| Invalid `status` (not operational, including `REMOVED`) | `400` |
| Target not found | `400` |
| Already-in-status **echo on this PATCH** | `200` (no-op), not `400` |
| Actor missing, not found, or not login-capable | `401` |
| Status delta + Actor not `ACTIVE` (lifecycle as-is) | `401` |
| `EMPLOYEE` token | `403` at `requireRoles` (and/or domain) |
| MANAGER on MANAGER / ADMIN / self | `403` |
| MANAGER sending a **different** `role` | `403` |
| Status delta refused by lifecycle matrix | `403` |
| Target Removed | `409` |
| Last Admin leaving `ADMIN`, or Last Admin Status transition | `409` |
| Unexpected (including 0-document `$set`) | `500` |

**Presence:** `'jobTitle' in request` (JSON `null` is present → clear). After `adaptRoute`, detect professional / status / dangerous keys on the flattened request. Do not treat path `id`, stamped `actorId`, or `actorRole` as professional keys.

| Present value | Controller forwards |
|---------------|---------------------|
| `jobTitle: null` / `""` / whitespace-only | `null` (clear) |
| `jobTitle` any other string | that string, unchanged (do not trim content) |
| `role` / `status`: `null` / `""` / whitespace-only | **do not forward** — `400` `InvalidParamError` for that field |
| `role` / `status` non-empty string | that string (enum check is use case / domain) |
| `password` key present (any value, including `null`) | `400` immediately; do not call the port |
| `employmentId` and other unknown keys (`name`, `email`, `gender`, `foo`) | **ignored**; they do not count as a field to correct |

A body with only unknown keys (including only `employmentId`) is `400` because no `jobTitle` / `role` / `status` is present.

This is **not** the Main Data rule that rejects `status` on sight. Status may travel here. This is **not** the Personal Data rule that ignores `password`; `password` is refused on sight.

`POST /api/employee/update-status` stays unchanged (already-in-status still `400`). Do not edit that controller.

Controllers stay Express-free.

## Request type — `presentation/http/update-professional-employee-data.request.ts`

```ts
export type UpdateProfessionalEmployeeDataRequest = {
  id?: string
  actorId?: string
  actorRole?: string
  jobTitle?: string | null
  role?: string | null
  status?: string | null
  password?: unknown
  employmentId?: unknown
}
```

Raw HTTP shape (pre-validation). Do not reuse the typed application DTO as this type. The use-case DTO's `role` / `status` are `string | undefined` only (never `null`).

## Controller (normative)

Express-free. Inject inbound port only.

Order:

1. If `'password' in request` → `400` `InvalidParamError('password')`. Do not call the port.
2. Collect present command keys: `jobTitle`, `role`, `status` (`key in request`). Ignore `employmentId` / Main / Personal / unknown keys.
3. None of the three present → `400` `MissingParamError` (wording `'no professional-data fields'`). Do not call the port.
4. `role` present and (`null` / `''` / whitespace) → `400` `InvalidParamError('role')`. Do not forward.
5. `status` present and (`null` / `''` / whitespace) → `400` `InvalidParamError('status')`. Do not forward.
6. `jobTitle` present + `""` / whitespace / `null` → forward `null`.
7. Forward `{ actorId: String(request.actorId ?? ''), id: String(request.id), ...present normalized command keys }`. Do not require `actorId` as a missing-param. Omit keys that were not in the request.
8. Success → `ok({ id })`.
9. `catch` map:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmployeeProfessionalDataForbiddenError` | `forbidden` (`403`) |
| `EmployeeLifecycleForbiddenError` | `forbidden` (`403`) |
| `LastAdminProtectedError` | `conflict` (`409`) |
| `EmployeeAlreadyRemovedError` | `conflict` (`409`) |
| `EmployeeNotFoundError` | `badRequest` (`400`) |
| `EmptyProfessionalEmployeeDataError` | `badRequest` (`400`) |
| `InvalidEmployeeRoleError` | `badRequest` (`400`) |
| `InvalidEmployeeStatusError` | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

Do **not** map `EmployeeMainDataForbiddenError` or `EmployeePersonalDataForbiddenError`. Do **not** map `EmployeeAlreadyActiveError` / `EmployeeAlreadyInactiveError` / `EmployeeAlreadyOnVacationError` to `400` — this PATCH must not throw them on an echo; if they leak, they fall through to `500` so the bug is visible. Dedicated Update Status keeps those as `400`.

## Module factory

Extend `makeEmployeesModule` (same repository instance, **same** `lifecyclePolicy` already constructed for Update Status / Remove):

```ts
const professionalDataPolicy = new EmployeeProfessionalDataPolicy(
  employeeRepository,
)
const professionalDataPatchService = new EmployeeProfessionalDataPatchService()

const updateProfessionalEmployeeData = new UpdateProfessionalEmployeeDataUsecase(
  employeeRepository,
  professionalDataPolicy,
  professionalDataPatchService,
  lifecyclePolicy,
  employeeRepository,
)

const updateProfessionalEmployeeDataController =
  new UpdateProfessionalEmployeeDataController(updateProfessionalEmployeeData)
```

Pass the controller into `makeEmployeeRoutes`. Return it from the module if the existing return shape lists controllers; stay consistent.

Do not construct the repository inside the controller or use case. Do not construct a second `EmployeeLifecyclePolicy`. `app.ts` unchanged (middleware already injected). `EmployeeProfessionalDataPolicy` receives the repository because it already implements `countLoginCapableAdmins` and `countNonRemovedAdmins`. Do not pass `CountActiveAdminsPort` as a distinct object.

## `.http`

Add samples under `src/client/employee.http`. No `actorId` / body `id`. Comment that the Target is `:id` and the Actor comes from the Bearer token.

Minimum samples:

- ADMIN + `{ "jobTitle": "Barbeiro" }`
- `{ "jobTitle": null }` (clear)
- One full body `{ "jobTitle": "Barbeiro", "role": "EMPLOYEE", "status": "ACTIVE" }`
- Comment: `password` → `400`; `employmentId` ignored and does not count as a field; `role` / `status` present + null/blank → `400`; echoed `role` / `status` → `200` no-op; Status delta still uses lifecycle; `POST /employee/update-status` is unchanged

## `AGENT.md` (living contract)

Update in place — not a changelog dump:

- Delivered table: Update Professional Employee Data → `PATCH /api/employee/:id/professional-data`
- Role gate / auth rows: include the new PATCH
- Directory map: new DTO / ports / resolver / use case / request / controller / policy / patch service / count port
- Domain: `changeJobTitle`; `EmployeeProfessionalDataPolicy`; `EmployeeProfessionalDataPatchService`; the two new errors; `CountLoginCapableAdminsPort`
- Application section for this command (ports, DTO, flow, skip persist on echo, Status delta reuses lifecycle, never `updateStatus`)
- HTTP: route line + error table + presence rules (`password` refused; `employmentId` ignored; `jobTitle` clearable; `role` / `status` not clearable) + sequence
- Persistence: repository implements `countLoginCapableAdmins` and `updateProfessionalData`; `countActiveAdmins` unchanged
- Wiring list: construct professional policy (repository) + patch service + use case (shared lifecycle) + controller
- Open decisions (design §17): lifecycle Actor still `ACTIVE`-only (VACATION + Status delta → `401`); Deactivate Last Admin still uses `countActiveAdmins`; leftover JWT after Role / Status change (Auth sibling); `employmentId` not written; Get-by-id still a follow-up; Vue Save may always echo `role` + `status` (this PATCH treats equals as no-op)
- Future work: drop “professional section” from the Get-by-id / professional hole; keep Get-by-id as its own query

## Files

| File | Action |
|------|--------|
| `presentation/http/update-professional-employee-data.request.ts` | Create |
| `presentation/controllers/update-professional-employee-data.controller.ts` + `*.spec.ts` | Create |
| `infrastructure/inbound/http/employee.routes.ts` | `PATCH` + `requiredRoleEmployee` |
| `employees.module.ts` | Wire policy + patch service + use case + controller |
| `src/client/employee.http` | Samples |
| `src/modules/employees/AGENT.md` | Living contract |
| Policy / use case / schema / `update-employee-status.controller.ts` | Do not re-implement; do not edit Update Status |

## Spec expectations (`update-professional-employee-data.controller.spec.ts`)

Stub inbound port. Do not test Express middleware here (`requireRoles` / `adaptRoute` already have their own specs).

| `it(...)` | Assert |
|-----------|--------|
| `{}` / only `{ name: 'X' }` / only `{ employmentId: 'M-1' }` | `400`; port not called |
| `{ password: 'secret' }` / `{ password: null }` | `400` `InvalidParamError('password')`; port not called |
| `{ jobTitle: 'Barbeiro' }` | port `{ actorId, id, jobTitle: 'Barbeiro' }`; no `role` / `status` |
| `{ jobTitle: null }` / `{ jobTitle: '' }` / `{ jobTitle: '   ' }` | port `jobTitle: null` |
| `{ jobTitle: ' Barbeiro ' }` | forwarded unchanged (spaces kept) |
| `{ role: null }` / `{ role: '' }` / `{ role: '   ' }` | `400`; port not called |
| `{ status: null }` / `{ status: '' }` | `400`; port not called |
| `{ role: 'MANAGER' }` | port `{ role: 'MANAGER' }` |
| `{ status: 'INACTIVE' }` | port `{ status: 'INACTIVE' }` |
| `{ jobTitle: 'Barbeiro', role: 'EMPLOYEE', status: 'ACTIVE' }` | all three forwarded |
| `{ jobTitle: 'Barbeiro', employmentId: 'M-1', name: 'X' }` | port has `jobTitle` only |
| forwards path `id` and stamped `actorId` | body `id` / `actorId` must not win — assert the values the controller reads from the flattened request |
| `ActorAuthenticationFailedError` | `401` |
| `EmployeeProfessionalDataForbiddenError` | `403` |
| `EmployeeLifecycleForbiddenError` | `403` |
| `LastAdminProtectedError` | `409` |
| `EmployeeAlreadyRemovedError` | `409` |
| `EmployeeNotFoundError` / `EmptyProfessionalEmployeeDataError` / `InvalidEmployeeRoleError` / `InvalidEmployeeStatusError` | `400` |
| generic throw | `500` |
| success | `200` `{ data: { id } }` |

## Checklist (agent)

- [ ] Route uses `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`
- [ ] Presence ignores `id` / `actorId` / `actorRole` / `employmentId`
- [ ] Unknown keys ignored; empty / unknown-only / only-`employmentId` body → `400`; no write
- [ ] `password` key → `400`; port not called
- [ ] Blank / null `jobTitle` → `null`; blank / null `role` / `status` → `400`
- [ ] HTTP map matches the table (professional forbidden **and** lifecycle forbidden → `403`; Last Admin → `409`)
- [ ] Already-in-status errors are **not** mapped to `400` on this controller
- [ ] Module injects `EmployeeProfessionalDataPolicy(repository)` and the **same** `lifecyclePolicy`
- [ ] `.http` has a Professional Data sample without `actorId`
- [ ] `AGENT.md` lists the command, ports, route, leftover-JWT, and lifecycle-Actor open decisions
- [ ] Co-located controller spec passes
- [ ] `POST /api/employee/update-status` unchanged
- [ ] No Get-by-id; no change to Main / Personal / lifecycle policies

## Out of scope

- `GET /api/employee/:id`
- Main Data and Personal Data sections
- Self-service (`EMPLOYEE` editing their own professional data)
- Writing `employmentId`
- Widening `EmployeeLifecyclePolicy` Actor to login-capable
- Widening `countActiveAdmins`
- Revoking Session Tokens after Role / Status change
- Replacing Update Status

## Acceptance criteria

Mirrors design §18 at the HTTP boundary:

- [ ] ADMIN + Target `EMPLOYEE` + `{ "jobTitle": "Barbeiro" }` → `200 { data: { id } }`; role and status unchanged
- [ ] `{ "jobTitle": "" }` or `{ "jobTitle": null }` → Job Title becomes `null`; other fields unchanged
- [ ] ADMIN + `{ "role": "MANAGER" }` on an `EMPLOYEE` → role persisted
- [ ] ADMIN + Last Admin leaving `ADMIN` → `409`; no write
- [ ] Last login-capable ADMIN is `VACATION` + leaving `ADMIN` → `409`
- [ ] MANAGER + Target `EMPLOYEE` + echoed current `role` + new `jobTitle` → `200`; Job Title persisted
- [ ] MANAGER + Target `EMPLOYEE` + **different** `role` → `403`; Job Title / status not persisted
- [ ] MANAGER + Target `MANAGER` / `ADMIN` / self → `403`
- [ ] EMPLOYEE token → `403`
- [ ] `{ "status": "INACTIVE" }` when Target is `ACTIVE` → lifecycle + persist `status` / `deactivateAt`
- [ ] `{ "status": "ACTIVE" }` when Target is already `ACTIVE` → `200`; no already-in-status error; no write unless Job Title also present
- [ ] `{ "status": "REMOVED" }` → `400`; no write
- [ ] `POST /api/employee/update-status` with the same status as current still → `400`
- [ ] Target `REMOVED` → `409`
- [ ] Target `INACTIVE` + Job Title or Role patch → allowed; not Reactivate
- [ ] `{}` or only unknown keys → `400`
- [ ] `password` in the body → `400`
- [ ] Body cannot spoof `actorId`; Target id is `:id`
- [ ] Persistence writes only the fields that changed (no full document / redacted password / no `employmentId`)
- [ ] Role-delta refusal or lifecycle refusal → no partial write
- [ ] Actor `VACATION` + Job Title only → `200`
- [ ] Actor `VACATION` + Status **delta** → `401`; no write
- [ ] `AGENT.md` lists the new command; `employee.http` has a Professional Data sample

## Reference map

| Concern | Look at |
|---------|---------|
| Adapter stamp order | `src/shared/infrastructure/adapters/http/express-route.adapter.ts` |
| Role gate | `makeRequireRoles` + existing `requiredRoleEmployee` |
| Sibling HTTP map (presence / clearable) | `presentation/controllers/update-personal-employee-data.controller.ts` |
| Sibling HTTP map (password on sight) | `presentation/controllers/update-main-employee-data.controller.ts` |
| Lifecycle HTTP map to reuse for Status delta | `presentation/controllers/update-employee-status.controller.ts` (`forbidden` / `conflict` rows only — do not copy already-in-status → `400`) |
| Routes today | `infrastructure/inbound/http/employee.routes.ts` |
| Wiring today | `employees.module.ts` (`lifecyclePolicy` already constructed) |
| Living contract | `src/modules/employees/AGENT.md` |
