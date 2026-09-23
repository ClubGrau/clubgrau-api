# Spec: Slice 3 — HTTP + contract (`PATCH /employee/:id/personal-data`)

> Public surface, wiring, and living contract.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-usecase.md`](./02-usecase.md).  
> Design §9 / §11 / §12. PRD HTTP table.  
> Jira: TBD.  
> Next: none (self-service stays a new command and a new policy).

## Responsibility (this spec only)

Ship `PATCH /api/employee/:id/personal-data` through the hexagon: request shape → controller → route → module → `.http` → `AGENT.md`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md)–[`02`](./02-usecase.md) | Policy, patch service, persist, use case already shipped |
| **This file** | HTTP gate, presence, `nif` coercion, error map, wiring, contract docs |

## When to use this spec

Follow the constitution **new command** playbook for presentation + inbound HTTP + module. Reuse `authTokenMiddleware`, `requireRoles('ADMIN', 'MANAGER')`, and `adaptRoute`. Do not add Get-by-id. Do not add a personal-data intent to `EmployeeMainDataPolicy`.

| Artifact | This slice? |
|----------|-------------|
| `UpdatePersonalEmployeeDataRequest` | Yes |
| Controller + spec | Yes |
| `PATCH /employee/:id/personal-data` + `requireRoles` | Yes |
| `makeEmployeesModule` wiring | Yes |
| `src/client/employee.http` sample | Yes |
| Living `AGENT.md` (delivered table, ports, HTTP, directory map) | Yes |
| Get-by-id / main / professional / self-service | **No** |
| Schema migration | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of Update Personal Employee Data following [`docs/specs/update-personal-employee-data/03-http-and-contract.md`](./03-http-and-contract.md).  
> `PATCH /api/employee/:id/personal-data` with `authTokenMiddleware` + `requireRoles('ADMIN','MANAGER')`. Sparse presence. Coerce body `nif` number → string. Blank `languages` / `address` → `null`. Map `EmployeePersonalDataForbiddenError` → `403`. Map `InvalidEmployeeGenderError` → `400` `InvalidParamError('gender')`.  
> Do not trust body `id` / `actorId`. Update `employee.http` and `AGENT.md`. Do not add self-service or the professional section.

## HTTP surface

```http
PATCH /api/employee/:id/personal-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{
  "gender": "male",
  "languages": "Português",
  "emergencyContact": "+351 912 345 678",
  "nif": "123456789",
  "address": "Rua do Grau, 10, Lisboa"
}
```

`:id` is the Target. Do not send `id` or `actorId` in the body. `adaptRoute` merges body then **params** then stamps `actorId` last — path `id` wins over a forged body `id`; JWT wins over a forged `actorId`.

```ts
router.patch(
  '/employee/:id/personal-data',
  authTokenMiddleware,
  requiredRoleEmployee, // requireRoles('ADMIN', 'MANAGER')
  adaptRoute(updatePersonalEmployeeDataController),
)
```

Success: `200` `{ data: { id } }` via `ok(...)`.

| Situation | HTTP |
|-----------|------|
| No personal field / only unknown keys | `400` |
| `gender` non-null and not in the enum, including `""` | `400` `Invalid param gender` |
| `emergencyContact` invalid phone format | `400` |
| `nif` invalid format / bad check digit | `400` |
| Target not found | `400` |
| Actor missing, not found, or not login-capable | `401` |
| `EMPLOYEE` token | `403` at `requireRoles` (and/or domain) |
| MANAGER on MANAGER / ADMIN / self | `403` |
| Target Removed | `409` |
| Unexpected (including 0-document `$set`) | `500` |

**Presence:** `'gender' in request` (JSON `null` is present → clear). After `adaptRoute`, detect personal fields on the flattened request. Do not treat path `id`, stamped `actorId`, or `actorRole` as personal data keys.

**Clearable vs rejected empty strings:**

| Present value | Controller forwards |
|---------------|---------------------|
| `gender: null` | `null` (clear) |
| `gender: ""` | `""` — not a clear. Domain throws `InvalidEmployeeGenderError`; this controller maps it to `InvalidParamError('gender')` |
| `languages` / `address`: `null`, `""`, or whitespace-only | `null` |
| `languages` / `address`: any other string | that string, unchanged (do not trim content) |
| `emergencyContact: null` | `null` |
| `emergencyContact` non-null | the string; `Phone.create` accepts or throws. Do not blank-normalize this field |
| `nif: null` | `null` |
| `nif` number (including `0`) | `String(value)` — `0` is not a clear |
| `nif` string | that string |

Unknown keys (`name`, `email`, `phone`, `username`, `status`, `password`, `role`, `foo`) are **ignored**. They do not `400` by themselves. A body with only unknown keys is `400` because no personal field is present. This is not the Main Data rule that rejects `status` / `password` on sight.

Controllers stay Express-free.

## Request type — `presentation/http/update-personal-employee-data.request.ts`

```ts
export type UpdatePersonalEmployeeDataRequest = {
  id?: string
  actorId?: string
  actorRole?: string
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | number | null
  address?: string | null
}
```

Raw HTTP shape (pre-validation). Do not reuse the typed application DTO as this type. The use-case DTO's `nif` is `string | null | undefined` only.

## Controller (normative)

Express-free. Inject inbound port only.

Order:

1. Collect present personal keys: `gender`, `languages`, `emergencyContact`, `nif`, `address` (`key in request`).
2. None present → `400` `MissingParamError` (same idea as Main Data's `'no main-data fields'`, wording `'no personal-data fields'`). Do not call the port.
3. Normalize the present keys (table above). Omit keys that were not in the request — do not send them as `undefined` if the DTO constructor would drop them anyway; omitted must stay omitted.
4. Forward `{ actorId: String(request.actorId ?? ''), id: String(request.id), ...present normalized personal data }`. Do not require `actorId` as a missing-param.
5. Success → `ok({ id })`.
6. `catch` map:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmployeePersonalDataForbiddenError` | `forbidden` (`403`) |
| `EmployeeAlreadyRemovedError` | `conflict` (`409`) |
| `EmployeeNotFoundError` | `badRequest` (`400`) |
| `EmptyPersonalEmployeeDataError` | `badRequest` (`400`) |
| `InvalidEmployeeGenderError` | `badRequest(new InvalidParamError('gender'))` — do not forward the domain error instance |
| `InvalidPhoneFormatError` | `badRequest` (`400`) |
| `InvalidNifError` | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

Do **not** map `EmployeeMainDataForbiddenError` or `EmployeeLifecycleForbiddenError` here. Do not special-case `status` / `password` the way Update Main Employee Data does.

## Module factory

Extend `makeEmployeesModule` (same repository instance):

```ts
const personalDataPolicy = new EmployeePersonalDataPolicy()
const personalDataPatchService = new EmployeePersonalDataPatchService()

const updatePersonalEmployeeData = new UpdatePersonalEmployeeDataUsecase(
  employeeRepository,
  personalDataPolicy,
  personalDataPatchService,
  employeeRepository,
)

const updatePersonalEmployeeDataController =
  new UpdatePersonalEmployeeDataController(updatePersonalEmployeeData)
```

Pass the controller into `makeEmployeeRoutes`. Return it from the module if the existing return shape lists controllers; stay consistent.

Do not construct the repository inside the controller or use case. `app.ts` unchanged (middleware already injected). `EmployeeMainDataPatchService` keeps its occupancy port; do not pass that port into the personal patch service.

## `.http`

Add samples under `src/client/employee.http`. No `actorId` / body `id`. Comment that the Target is `:id` and the Actor comes from the Bearer token.

Minimum samples:

- ADMIN + `{ "gender": "male" }`
- `{ "nif": null }` (clear)
- One full five-field body matching the contract above
- Comment: unknown keys (`status`, `password`, `name`) are ignored; a body with none of the five personal fields → `400`; `gender: ""` → `400`

## `AGENT.md` (living contract)

Update in place — not a changelog dump:

- Delivered table: Update Personal Employee Data → `PATCH /api/employee/:id/personal-data`
- Directory map: new DTO / ports / resolver / use case / request / controller / policy / patch service
- Domain: `EmployeeModel.Gender`; the four `assign*` mutators; `EmployeePersonalDataPolicy`; `EmployeePersonalDataPatchService`; the three new errors
- Application section for this command (ports, DTO, flow, no occupancy)
- HTTP: route line + error table + the `nif` number → string note + sequence
- Persistence: repository implements `updatePersonalData`; `nif` string → `Number` inside `$set`
- Wiring list: construct policy + patch service + use case + controller
- Open decisions: self-service is a **new** policy, not a change to `EmployeePersonalDataPolicy`; `languages` stays `string | null`; `emergencyContact` stays `Phone` only

## Files

| File | Action |
|------|--------|
| `presentation/http/update-personal-employee-data.request.ts` | Create |
| `presentation/controllers/update-personal-employee-data.controller.ts` + `*.spec.ts` | Create |
| `infrastructure/inbound/http/employee.routes.ts` | `PATCH` + `requiredRoleEmployee` |
| `employees.module.ts` | Wire policy + patch service + use case + controller |
| `src/client/employee.http` | Samples |
| `src/modules/employees/AGENT.md` | Living contract |
| Policy / use case / schema | Do not re-implement |

## Spec expectations (`update-personal-employee-data.controller.spec.ts`)

Stub inbound port. Do not test Express middleware here (`requireRoles` / `adaptRoute` already have their own specs).

| `it(...)` | Assert |
|-----------|--------|
| `{}` / only `{ name: 'X' }` / only `{ status: 'INACTIVE', password: 'secret' }` | `400`; port not called |
| `{ gender: 'male' }` | port `{ actorId, id, gender: 'male' }`; no other personal keys |
| `{ gender: null }` | port `gender: null` |
| `{ gender: '' }` | port called with `gender: ''` (not `null`); the `400` mapping is the `InvalidEmployeeGenderError` row |
| `{ languages: '' }` / `{ languages: '   ' }` / `{ languages: null }` | port `languages: null` |
| `{ languages: ' Português ' }` | forwarded unchanged (spaces kept) |
| `{ address: '' }` / `{ address: null }` | port `address: null` |
| `{ emergencyContact: null }` | port `emergencyContact: null` |
| `{ nif: null }` | port `nif: null` |
| `{ nif: 123456789 }` | port `nif: '123456789'` (string) |
| `{ nif: '123456789' }` | port `nif: '123456789'` |
| forwards path `id` and stamped `actorId` | body `id` / `actorId` must not win — assert the values the controller reads from the flattened request |
| `ActorAuthenticationFailedError` | `401` |
| `EmployeePersonalDataForbiddenError` | `403` |
| `EmployeeAlreadyRemovedError` | `409` |
| `EmployeeNotFoundError` / `EmptyPersonalEmployeeDataError` / `InvalidPhoneFormatError` / `InvalidNifError` | `400` |
| `InvalidEmployeeGenderError` | `400` whose error is `InvalidParamError` with message `Invalid param gender` |
| generic throw | `500` |
| success | `200` `{ data: { id } }` |
| `{ gender: 'male', status: 'INACTIVE' }` | port called with `gender` only; `status` not forwarded |

## Checklist (agent)

- [ ] Route uses `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`
- [ ] Presence ignores `id` / `actorId` / `actorRole`
- [ ] Unknown keys ignored; empty / unknown-only body → `400`; no write
- [ ] `gender: ""` is not cleared in the controller
- [ ] Blank `languages` / `address` → `null`; `nif` number → string
- [ ] HTTP map matches the table (`403` is `EmployeePersonalDataForbiddenError`)
- [ ] `InvalidEmployeeGenderError` becomes `InvalidParamError('gender')`
- [ ] Module injects `EmployeePersonalDataPolicy` and `EmployeePersonalDataPatchService` with no ports
- [ ] `.http` has a Personal Data sample without `actorId`
- [ ] `AGENT.md` lists the command, ports, route, and the self-service open decision
- [ ] Co-located controller spec passes
- [ ] No Get-by-id; no change to Main Data or lifecycle policies

## Out of scope

- `GET /api/employee/:id`
- Main Data and professional sections
- Self-service (`UpdateOwnPersonalDataUsecase`)
- `languages` as an array
- Richer `emergencyContact` VO
- Revoking Session Tokens

## Acceptance criteria

- [ ] `PATCH /api/employee/:id/personal-data` with ADMIN + `{ "gender": "male" }` → `200 { data: { id } }`; other personal fields unchanged
- [ ] `{ "nif": null }` → NIF cleared; other personal fields unchanged
- [ ] `{ "emergencyContact": null }` → emergency contact cleared
- [ ] `{ "gender": "invalid" }` → `400`; no write
- [ ] `{ "emergencyContact": "123" }` → `400`; no write
- [ ] `{ "nif": "00000000" }` → `400`; no write
- [ ] `{}` or body with only unknown keys → `400`; no write
- [ ] Body with all five fields → `200`; all five in a single `$set`
- [ ] MANAGER + Target `EMPLOYEE` → allowed; MANAGER + Target `MANAGER` / `ADMIN` / self → `403`
- [ ] EMPLOYEE token → `403`
- [ ] Target `REMOVED` → `409`
- [ ] Target `INACTIVE` or `VACATION` + valid patch → allowed
- [ ] Persistence writes only the present personal fields
- [ ] Forged body `actorId` overwritten; forged body `id` loses to `:id`
- [ ] `{ "languages": "" }` or `{ "languages": null }` → languages `null`
- [ ] `{ "address": "Rua X" }` → address updated; other personal fields unchanged
- [ ] `nif` sent as a number → string before validation; stored as `Number` in Mongo
- [ ] `AGENT.md` lists the new command; `employee.http` has a Personal Data sample

## Reference map

| Concern | Look at |
|---------|---------|
| Adapter stamp order | `src/shared/infrastructure/adapters/http/express-route.adapter.ts` |
| Role gate | `makeRequireRoles` + existing `requiredRoleEmployee` |
| Sibling HTTP map | `presentation/controllers/update-main-employee-data.controller.ts` |
| Gender → `InvalidParamError` | this spec's catch table (Main Data does not have this translation) |
| Routes today | `infrastructure/inbound/http/employee.routes.ts` |
| Living contract | `src/modules/employees/AGENT.md` |
