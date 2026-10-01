# Spec: Slice 4 — HTTP + contract (`GET` + `PATCH /employee/me`)

> Public surface, wiring, and living contract for the Profile Card.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-usecase.md`](./02-usecase.md) and [`03-query.md`](./03-query.md).  
> Design §9.2 / §11 / §12 / §17.  
> Jira: TBD.  
> Next: none.

## Responsibility (this spec only)

Ship `GET /api/employee/me` and `PATCH /api/employee/me` through the hexagon: request shapes → controllers → routes → module → `.http` → `AGENT.md`. The target is the Actor from the Session Token. No path `:id`. No `requireRoles`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md)–[`03`](./03-query.md) | Policy, patch service, persist, read port, use case, and query already shipped |
| **This file** | HTTP gate, presence, clear rules, error map, wiring, contract docs |
| Prerequisite P | Already required before this feature's HTTP. Do not re-implement the Main username fix here |

## When to use this spec

Follow the constitution **new command** and **new query** playbooks for presentation + inbound HTTP + module. Reuse `authTokenMiddleware` and `adaptRoute`. Do not add `requireRoles` on these two routes.

| Artifact | This slice? |
|----------|-------------|
| `GetOwnEmployeeRequest` + `UpdateOwnEmployeeDataRequest` | Yes |
| Both controllers + specs | Yes |
| `GET` and `PATCH /employee/me` with `authTokenMiddleware` only | Yes |
| `makeEmployeesModule` wiring | Yes |
| `src/client/employee.http` samples | Yes |
| Living `AGENT.md` | Yes |
| Operator PATCH routes | **No** — leave `requireRoles('ADMIN', 'MANAGER')` as they are |
| Get-by-id of another collaborator | **No** |
| JWT reissue | **No** — document only |
| `UpdateMainEmployeeDataController` | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of Update Own Employee Data following [`docs/specs/update-own-employee-data/04-http-and-contract.md`](./04-http-and-contract.md).  
> `GET` and `PATCH /api/employee/me` with `authTokenMiddleware` only. Map `ActorAuthenticationFailedError` → `401`. Map empty / invalid param / VO errors → `400`.  
> Sparse presence. Clearable blanks → `null`. `name` / `phone` blank → `InvalidParamError` before `execute`. Ignored keys do not count.  
> Do not add `requireRoles`. Do not trust body `actorId`. Leave operator PATCHes unchanged. Update `employee.http` and `AGENT.md`.

## HTTP surface

```http
GET /api/employee/me
Authorization: Bearer <Actor token>
```

```http
PATCH /api/employee/me
Authorization: Bearer <Actor token>
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "+351 912 345 678",
  "username": "joao",
  "gender": "male",
  "languages": "Português",
  "emergencyContact": "+351 912 345 678",
  "nif": "123456789",
  "address": "Rua do Grau, 10, Lisboa"
}
```

No path `:id`. Do not send `id` or `actorId` in the body. `adaptRoute` spreads the body, then stamps `actorId` from the JWT, which overwrites a forged `actorId`. A body `id` is ignored.

```ts
router.get(
  '/employee/me',
  authTokenMiddleware,
  adaptRoute(getOwnEmployeeController),
)
router.patch(
  '/employee/me',
  authTokenMiddleware,
  adaptRoute(updateOwnEmployeeDataController),
)
```

`/employee/:id/main-data` does not capture `/employee/me`. Register the literal `me` paths. Do not add a Target parameter later to match the other PATCHes.

Success (GET and PATCH): `200` `{ data: GetEmployeesItemDto }` via `ok(readModel)`. Not `{ data: { id } }`.

| Situation | HTTP |
|-----------|------|
| PATCH with none of the eight writable keys (`{}`, only ignored keys, only `email`) | `400` `MissingParamError` — before `execute`, including when the Actor is `INACTIVE` |
| `name` or `phone` present and blank / `null` / whitespace | `400` `InvalidParamError` — before `execute`, including for an `INACTIVE` Actor |
| Invalid `name` VO, `phone`, `emergencyContact`, `gender`, `nif` | `400` |
| Use case reached with no defined writable field | `400` `EmptyOwnEmployeeDataError` |
| GET, or PATCH with at least one writable key: Actor id missing, not found, or not login-capable | `401` |
| Unexpected, `matchedCount === 0`, re-read `null` after a found Actor | `500` |

There is no `403` and no `409` on these two routes.

**Presence:** `'phone' in body` (JSON `null` is present). Do not treat stamped `actorId` or `actorRole` as a writable key.

**Writable keys:** `name`, `phone`, `username`, `gender`, `languages`, `emergencyContact`, `nif`, `address`.

**Ignored keys** (`email`, `password`, `status`, `role`, `jobTitle`, `employmentId`, `id`, unknown) do not count as a field to correct and do not `400` by themselves. Do not copy Main's rule that rejects `status` / `password` on sight. A body that has a writable key plus `status` still calls the port with the writable key only.

`PATCH /api/employee/:id/main-data`, `…/personal-data`, and `…/professional-data` stay `requireRoles('ADMIN', 'MANAGER')`.

Controllers stay Express-free.

## Request types

### `presentation/http/get-own-employee.request.ts`

```ts
export type GetOwnEmployeeRequest = {
  actorId?: string
  actorRole?: string
}
```

Raw HTTP shape. No `:id`. Do not reuse `GetEmployeesDto`.

### `presentation/http/update-own-employee-data.request.ts`

```ts
export type UpdateOwnEmployeeDataRequest = {
  actorId?: string
  actorRole?: string
  id?: string
  name?: string | null
  phone?: string | null
  username?: string | null
  gender?: string | null
  languages?: string | null
  emergencyContact?: string | null
  nif?: string | number | null
  address?: string | null
}
```

Raw HTTP shape (pre-validation). Do not reuse the typed application DTO as this type. The use-case DTO's `nif` is `string | null | undefined` only. `id` may appear because `adaptRoute` spreads the body; the controller does not forward it.

## `GetOwnEmployeeController` (normative)

Express-free. Inject `GetOwnEmployeePort` only.

1. `execute({ actorId: String(request.actorId ?? '') })`. Do not require `actorId` as `MissingParamError`. A missing stamp fails in the query as `401`.
2. Success → `ok(readModel)` (the whole `GetEmployeesItemDto`).
3. `catch`:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| anything else | `serverError` (`500`) |

Do not map `EmployeeNotFoundError`, `EmployeeAlreadyRemovedError`, or any `*ForbiddenError`.

## `UpdateOwnEmployeeDataController` (normative)

Express-free. Inject `UpdateOwnEmployeeDataPort` only.

Order:

1. Collect present writable keys (`key in request`). `actorId`, `actorRole`, and `id` are not writable keys.
2. None present → `400` `MissingParamError('no own-employee-data fields')`. Do not call the port. This includes `{}`, only ignored keys, and only `{ email }`, including when the Actor would have been `INACTIVE`.
3. `name` or `phone` present and blank (`null`, `undefined`, or whitespace-only string) → `400` `InvalidParamError(field)`. Do not call the port. Do not forward.
4. Normalize the other present writable keys (table below). Omit keys that were not in the request.
5. Forward `{ actorId: String(request.actorId ?? ''), ...present normalized writable data }`. No `id`.
6. Success → `ok(readModel)`.
7. `catch`:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmptyOwnEmployeeDataError` | `badRequest` (`400`) |
| `InvalidNameError` | `badRequest` (`400`) |
| `InvalidPhoneFormatError` | `badRequest` (`400`) |
| `InvalidNifError` | `badRequest` (`400`) |
| `InvalidEmployeeGenderError` | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

Do not map a forbidden or conflict helper on this controller. Do not translate `InvalidEmployeeGenderError` into `InvalidParamError` unless the thrown error is already the controller's own blank `name` / `phone` check.

| Present value | Controller forwards |
|---------------|---------------------|
| `name` / `phone` non-blank string | that string |
| `name` / `phone` `null` / `""` / whitespace | do not forward — `InvalidParamError` |
| `username`, `gender`, `languages`, `emergencyContact`, `address`: `null` / `""` / whitespace | `null` |
| those same fields, any other string | that string (do not trim `languages` / `address` / `gender`; username trim is the entity's job) |
| `nif: null` / `""` / whitespace | `null` |
| `nif` number (including `0`) | `String(value)` before the blank check — a numeric nif is not blank |
| `nif` non-blank string | that string |

`gender: "invalid"` is forwarded as that string. The patch service throws `InvalidEmployeeGenderError`; this controller maps that class to `400`.

## Module factory

Extend `makeEmployeesModule`. Reuse the existing `EmployeePersonalDataPatchService`, the repository, and `authTokenMiddleware`. Do not construct a second personal patch service. Do not construct the repository inside the controller, use case, or query.

```ts
const ownDataPolicy = new EmployeeOwnDataPolicy()
const ownDataPatchService = new EmployeeOwnDataPatchService(
  personalDataPatchService,
)

const updateOwnEmployeeData = new UpdateOwnEmployeeDataUsecase(
  employeeRepository,      // FindEmployeeByIdPort
  ownDataPolicy,
  ownDataPatchService,
  employeeRepository,      // UpdateOwnEmployeeDataRepositoryPort
  employeeRepository,      // FindOwnEmployeePort
)

const getOwnEmployee = new GetOwnEmployeeQuery(
  employeeRepository,
  ownDataPolicy,
)

const updateOwnEmployeeDataController =
  new UpdateOwnEmployeeDataController(updateOwnEmployeeData)
const getOwnEmployeeController =
  new GetOwnEmployeeController(getOwnEmployee)
```

Pass both controllers into `makeEmployeeRoutes`. Return them from the module if the existing return shape lists controllers. `app.ts` unchanged. `EmployeeMainDataPatchService` keeps its occupancy port; do not pass that port into the own patch service.

## `.http`

Add samples under `src/client/employee.http`. No body `actorId` / `id`. Comment that the Actor is the Bearer token and there is no `:id`.

Minimum samples:

- `GET /api/employee/me`
- `PATCH` `{ "phone": "+351 912 345 678" }`
- `PATCH` `{ "username": "" }` (clear)
- `PATCH` `{ "nif": null }` (clear)
- One full eight-field body matching the contract above
- Comment: ignored keys (`email`, `status`, `password`) do not count; `{}` or only `email` → `400`; `{ "name": "" }` or `{ "phone": "" }` → `400`; these two routes have no `requireRoles`

## `AGENT.md` (living contract)

Update in place — not a changelog dump:

- Delivered table: Get Own Employee → `GET /api/employee/me`; Update Own Employee Data → `PATCH /api/employee/me`
- Directory map: new error, policy, patch service, DTO, ports, resolver, use case, query, requests, controllers
- Domain: `EmployeeOwnDataPolicy.assertCan(status)`; `EmployeeOwnDataPatchService` delegates personal and calls `patchName` / `patchPhone` / `patchUsername`; `EmptyOwnEmployeeDataError`
- Application: command flow (policy → resolver → patch → one `$set` → re-read → `GetEmployeesItemDto`); query flow (read port → `assertCan(status)`); no occupancy; no `id` on the command DTO
- HTTP: both routes with `authTokenMiddleware` only; error table (`400` / `401` / `500`, no `403`, no `409`); presence and clear rules; sequences from design §12
- Persistence: repository implements `updateOwnData` and `findOwnEmployee`; non-null `nif` → `Number` inside `$set`; read model is `mapEmployeeReadModel`
- Wiring list: policy, own patch service (existing personal instance), use case, query, both controllers
- Open decisions (design §17, do not implement):
  - Session Token `name` may stay stale until the next login (Auth sibling)
  - `authTokenMiddleware` may still accept a leftover `INACTIVE` / `REMOVED` JWT; this feature enforces login-capable in the employees domain
  - `GET /employee/me` does not replace get-by-id of another collaborator
  - `languages` / `emergencyContact` stay `string | null`
  - Username uniqueness is still absent
- Operator PATCH routes stay `requireRoles('ADMIN', 'MANAGER')`

## Files

| File | Action |
|------|--------|
| `presentation/http/get-own-employee.request.ts` | Create |
| `presentation/http/update-own-employee-data.request.ts` | Create |
| `presentation/controllers/get-own-employee.controller.ts` + `*.spec.ts` | Create |
| `presentation/controllers/update-own-employee-data.controller.ts` + `*.spec.ts` | Create |
| `infrastructure/inbound/http/employee.routes.ts` | `GET` + `PATCH /employee/me`, `authTokenMiddleware` only |
| `employees.module.ts` | Wire policy, patch service, use case, query, both controllers |
| `src/client/employee.http` | Samples |
| `src/modules/employees/AGENT.md` | Living contract |
| Operator controllers / policies / Main username controller | Do not change |

## Spec expectations

Stub the inbound port. Do not test Express middleware here (`authTokenMiddleware` / `adaptRoute` already have their own specs).

### `get-own-employee.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| forwards stamped `actorId` | port `{ actorId }` |
| missing `actorId` | port `{ actorId: '' }`; not `MissingParamError` |
| `ActorAuthenticationFailedError` | `401` |
| generic throw | `500` |
| success | `200` `{ data }` is the read model; `'password' in data` is false; not `{ id }` only |

### `update-own-employee-data.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `{}` / only `{ email }` / only `{ status, password, role }` / only `{ id: 'other' }` | `400` `MissingParamError`; port not called |
| `{ name: '' }` / `{ name: '   ' }` / `{ name: null }` | `400` `InvalidParamError`; port not called |
| `{ phone: '' }` / `{ phone: null }` | `400` `InvalidParamError`; port not called |
| `{ name: 'João Silva' }` | port `{ actorId, name }`; no other writable keys |
| `{ phone: '+351 912 345 678' }` | port `{ actorId, phone }` |
| `{ username: '' }` / `{ username: '   ' }` / `{ username: null }` | port `username: null` |
| `{ username: 'joao' }` | port `username: 'joao'` |
| `{ gender: '' }` / `{ gender: null }` / `{ gender: '   ' }` | port `gender: null` |
| `{ gender: 'invalid' }` | port called with `gender: 'invalid'` (domain `400` is the error-map row) |
| `{ languages: '' }` / `{ languages: null }` | port `languages: null` |
| `{ languages: ' Português ' }` | forwarded unchanged |
| `{ address: '' }` / `{ emergencyContact: '' }` | port that key `null` |
| `{ nif: null }` / `{ nif: '' }` / `{ nif: '   ' }` | port `nif: null` |
| `{ nif: 123456789 }` | port `nif: '123456789'` |
| `{ nif: 0 }` | port `nif: '0'` |
| `{ email, address: 'Rua B' }` | port `{ actorId, address }` only |
| `{ name: 'João Silva', status: 'INACTIVE', password: 'secret' }` | port `name` only |
| forged body `actorId` | the controller reads the flattened request `actorId` (the stamp). It does not prefer a second body field. It does not forward `id` |
| `ActorAuthenticationFailedError` | `401` |
| `EmptyOwnEmployeeDataError` / `InvalidNameError` / `InvalidPhoneFormatError` / `InvalidNifError` / `InvalidEmployeeGenderError` | `400` |
| generic throw | `500` |
| success | `200` `{ data }` is the read model from the port, not `{ id }` |

## Checklist (agent)

- [ ] Both routes use `authTokenMiddleware` + `adaptRoute` and do not use `requireRoles`
- [ ] No path `:id`; body `id` is not forwarded
- [ ] Presence ignores `actorId` / `actorRole` / `id`
- [ ] Empty or ignored-only body → `400` before `execute`
- [ ] Blank `name` / `phone` → `InvalidParamError` before `execute`
- [ ] Clearable blanks (`username` and the five personal fields) → `null`
- [ ] `nif` number → string before the blank check
- [ ] HTTP map is `401` for `ActorAuthenticationFailedError`, `400` for empty / VO errors, `500` otherwise
- [ ] No `403` / `409` mapping on these controllers
- [ ] Success is `ok(GetEmployeesItemDto)` for GET and PATCH
- [ ] Module reuses the existing personal patch service and the same repository for find-by-id, `updateOwnData`, and `findOwnEmployee`
- [ ] `.http` has GET and PATCH samples without body `actorId`
- [ ] `AGENT.md` lists both operations, the routes, and the open Auth / get-by-id decisions
- [ ] Operator PATCH routes unchanged
- [ ] Co-located controller specs pass

## Out of scope

- Get employee by id of another collaborator
- Edit Collaborator matrices and `requireRoles` changes
- Email occupancy
- Revoking or reissuing the Session Token
- Authenticated change-password
- Fetching the card at application boot
- Changing `UpdateMainEmployeeDataController` (prerequisite P)

## Acceptance criteria

- [ ] Login-capable `EMPLOYEE` + `GET /api/employee/me` → `200` with the list-shaped read model, no `password`
- [ ] Login-capable `MANAGER` / `ADMIN` + same GET → `200` of self, not a list
- [ ] The API does not require a GET before PATCH
- [ ] `PATCH` `{ "phone": "+351 912 345 678" }` → `200` with the updated read model; email unchanged
- [ ] `{ "username": "" }` → username `null`; other fields unchanged
- [ ] `{ "name": "" }` or `{ "phone": "" }` → `400` before `execute`; no write
- [ ] `{ "email": "other@example.com", "address": "Rua B" }` → address persisted; email unchanged
- [ ] `{ "email": "other@example.com" }` only → `400`; no write
- [ ] `{ "gender": "invalid" }` → `400`; no write
- [ ] `{ "nif": null }` → NIF cleared
- [ ] Body with `name` + invalid `nif` → `400`; name not persisted
- [ ] `{}` or only unknown / ignored keys → `400`, including for an `INACTIVE` Actor
- [ ] `VACATION` Actor → GET and PATCH allowed
- [ ] Actor `INACTIVE` or `REMOVED` + a writable key → `401` on PATCH; no write. Same Actor on GET → `401`
- [ ] No `requireRoles` on these two routes; `EMPLOYEE` is not `403` here
- [ ] `PATCH /api/employee/:id/main-data` and `…/personal-data` still refuse `EMPLOYEE` and refuse `MANAGER` + self
- [ ] Body cannot spoof `actorId`; there is no Target `:id`
- [ ] Persistence writes only present writable keys. Non-null `nif` is stored as a number
- [ ] PATCH `200` body is the same read model as GET
- [ ] Session Token is not reissued on success
- [ ] `AGENT.md` lists the command and the query; `employee.http` has Profile Card samples

## Reference map

| Concern | Look at |
|---------|---------|
| Adapter stamp order | `src/shared/infrastructure/adapters/http/express-route.adapter.ts` |
| Sibling HTTP presence | `presentation/controllers/update-personal-employee-data.controller.ts` |
| Main username clear (prerequisite, do not edit here) | `docs/specs/update-main-employee-data/03-http-and-contract.md` |
| Routes today | `infrastructure/inbound/http/employee.routes.ts` |
| Living contract | `src/modules/employees/AGENT.md` |
| Glossary | `src/modules/employees/CONTEXT.md` |
