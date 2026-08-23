# Spec: Update Employee Status — Controller

> Implementation contract for the **presentation + inbound HTTP** slice of `update-employee-status`.  
> Feature folder: [`docs/specs/update-employee-status/`](./).  
> Global rules: [`AGENTS.md`](../../../AGENTS.md).  
> Module contract: [`src/modules/employees/AGENT.md`](../../../src/modules/employees/AGENT.md).  
> Canonical mirrors: [`CreateEmployeeController`](../../../src/modules/employees/presentation/controllers/create-employee.controller.ts), [`GetEmployeesController`](../../../src/modules/employees/presentation/controllers/get-employees.controller.ts), [`makeEmployeeRoutes`](../../../src/modules/employees/infrastructure/inbound/http/employee.routes.ts), [`makeEmployeesModule`](../../../src/modules/employees/employees.module.ts), [`makeApp`](../../../src/app.ts).

## When to use this spec

Use this document to implement the HTTP controller, its co-located tests, the route, and the composition-root wiring from the module factory up to API bootstrap.

This spec must be **executable even when the route does not exist yet**. Do not assume a placeholder in `employee.routes.ts`. If a leftover stub class or unused path is present, replace it; if nothing is there, add the route from scratch.

| Artifact | This slice? |
|----------|-------------|
| Presentation request type | Yes |
| Controller + `*.controller.spec.ts` | Yes |
| Application DTO + inbound port (interfaces only) | Yes — controller cannot compile without them |
| Route in `makeEmployeeRoutes` | Yes — create it if missing |
| Module factory `makeEmployeesModule` | Yes — instantiate controller and pass it into the routes factory |
| API bootstrap `makeApp` (`app.ts`) | Yes — keep `/api` mount working; change `makeApp` only if the module factory signature changes |
| Manual `.http` sample + employees `AGENT.md` | Yes — public HTTP surface changed |
| Use case / entity transitions / repository | **No** → later sibling spec (`usecase.md`) |

**Prompt sketch for the agent:**

> Implement `UpdateEmployeeStatusController` following [`docs/specs/update-employee-status/controller.md`](./controller.md).  
> Mirror `CreateEmployeeController` (required fields + `serverError`) and `GetEmployeesController` (`status` validation).  
> Stub `UpdateEmployeeStatusPort` in unit tests.  
> Add `POST /employee/update-status` in `makeEmployeeRoutes`, wire the controller in `makeEmployeesModule`, and confirm `makeApp` still mounts `employees.router` at `/api`.  
> Do not implement the use case — inject a temporary port in the module factory until `usecase.md`.

## HTTP surface

| Item | Contract |
|------|----------|
| Method / path | `POST /api/employee/update-status` |
| Auth | Required on the **route** (`authTokenMiddleware`) — **not** the controller’s job |
| Body | `{ id, status }` (both required) |
| `status` values | `ACTIVE` \| `INACTIVE` \| `VACATION` (`EmployeeModel.Status`) |
| Missing `id` or `status` | `400` + `MissingParamError` |
| Invalid `status` (not in the enum) | `400` + `InvalidParamError('status')` |
| Success | `200` + `{ data: { id, status } }` via `ok(...)` |
| Inbound port throws | `500` via `serverError(...)` |

Do **not** introduce `404` / domain-error HTTP mapping in this slice. Domain failures (`EmployeeNotFoundError`, already-in-status errors, …) are thrown by the use case later and currently surface as `500`, same granularity as create employee. Broader mapping is an [open decision](#open-decisions) for a later spec.

## Application contracts this slice may add

Create these as **interfaces only**. No use-case class. No outbound port.

### DTO — `application/dtos/update-employee-status.dto.ts`

```ts
interface UpdateEmployeeStatusDto {
  id: string;
  status: EmployeeModel.Status;
}

interface UpdateEmployeeStatusResultDto {
  id: string;
  status: EmployeeModel.Status;
}
```

No DTO `*.spec.ts` in this slice (create-employee’s DTO spec is ceremonial; skip unless a later spec asks for it).

### Inbound port — `application/ports/inbound/update-employee-status.port.ts`

```ts
interface UpdateEmployeeStatusPort {
  execute(params: UpdateEmployeeStatusDto): Promise<UpdateEmployeeStatusResultDto>;
}
```

### HTTP request — `presentation/http/update-employee-status.request.ts`

Raw body **before** validation (same reason as `GetEmployeesRequest`: `status` arrives as `string` via `adaptRoute`).

```ts
export type UpdateEmployeeStatusRequest = {
  id?: string;
  status?: string;
};
```

Do **not** type the controller `handle` argument as `UpdateEmployeeStatusDto`. The DTO is the **output** of controller validation, passed into the port.

## Pattern (normative)

### Controller

`UpdateEmployeeStatusController` extends `BaseController<UpdateEmployeeStatusRequest, HttpErrorBody | HttpSuccessBody<UpdateEmployeeStatusResultDto>>`.

1. **Constructor** injects `UpdateEmployeeStatusPort` only. No repository, no entity, no Express.
2. **`handle`** wrapped in `try/catch` → `serverError(error as Error)` on throw.
3. **Required fields** via `this.validationRequiredFields(request, ['id', 'status'])`. Missing → `badRequest(new MissingParamError(field))`. Do **not** call the port.
4. **Status enum** via `EmployeeModel.isStatus(request.status)`. Invalid → `badRequest(new InvalidParamError('status'))`. Do **not** call the port. Do **not** re-validate format of `id` (ObjectId, etc.) — that belongs to the use case / persistence later.
5. **Forward** `{ id: request.id, status: request.status }` into `updateEmployeeStatus.execute(...)`. `status` is narrowed by `isStatus`.
6. **Success** → `ok({ id: result.id, status: result.status })` (`200`, not `201`).
7. **No VO / entity / status-transition logic** in the controller. `activate` / `deactivate` / `putOnVacation` stay on `Employee` for the use-case spec.

### Route

In `makeEmployeeRoutes`, register (create from scratch if absent):

```ts
router.post(
  '/employee/update-status',
  authTokenMiddleware,
  adaptRoute(updateEmployeeStatusController),
);
```

Rules:

- Import the **real** `UpdateEmployeeStatusController`. Never keep a local placeholder `class UpdateEmployeeStatusController {}`.
- Add `updateEmployeeStatusController: UpdateEmployeeStatusController` to `EmployeeRoutesDependencies`.
- Same auth middleware as create/list. Controllers stay Express-free; Express lives only in this inbound adapter.
- Do **not** put `:id` in the path — `id` is in the body.

### Module factory → API bootstrap

Composition chain (must exist after this slice):

```text
makeApp
  → makeEmployeesModule({ connection, encrypter, authTokenMiddleware })
      → new UpdateEmployeeStatusController(updateEmployeeStatusPort)
      → makeEmployeeRoutes({ …, updateEmployeeStatusController, authTokenMiddleware })
      → router.post('/employee/update-status', …)
  → app.use('/api', employees.router)
```

| Step | File | What to do |
|------|------|------------|
| 1 | `employees.module.ts` | Construct `UpdateEmployeeStatusController` with an `UpdateEmployeeStatusPort`. Pass it into `makeEmployeeRoutes`. Export it on `EmployeesModule` if the other controllers are exported. |
| 2 | Temporary port | Until `usecase.md`, inject a **temporary** port in the factory (inline object or tiny class) that implements `UpdateEmployeeStatusPort` and rejects with a clear message (e.g. `UpdateEmployeeStatusUsecase not implemented`). The use-case spec **replaces** this stub — do not invent domain logic here. |
| 3 | `app.ts` / `makeApp` | `employees.router` is already mounted at `/api`. Do **not** remount or add a second `app.use`. Change `makeApp` **only** if `makeEmployeesModule` needs a new dependency (it should not for this slice). Confirm the public path is `POST /api/employee/update-status`. |

### Docs / client

- Add a sample request to `src/client/employee.http`.
- Update employees `AGENT.md` (HTTP surface, routes snippet, wiring list). Do not treat it as a changelog.

### Files

| File | Action |
|------|--------|
| `src/modules/employees/application/dtos/update-employee-status.dto.ts` | Create |
| `src/modules/employees/application/ports/inbound/update-employee-status.port.ts` | Create |
| `src/modules/employees/presentation/http/update-employee-status.request.ts` | Create |
| `src/modules/employees/presentation/controllers/update-employee-status.controller.ts` | Create |
| `src/modules/employees/presentation/controllers/update-employee-status.controller.spec.ts` | Create |
| `src/modules/employees/infrastructure/inbound/http/employee.routes.ts` | Add route + real controller type on the routes factory (create if missing; replace any placeholder) |
| `src/modules/employees/employees.module.ts` | Instantiate controller, temporary port, pass into `makeEmployeeRoutes` |
| `src/app.ts` | Verify `/api` mount; edit only if the module factory signature changed |
| `src/client/employee.http` | Add `POST /api/employee/update-status` sample |
| `src/modules/employees/AGENT.md` | Update public HTTP + wiring |

## Spec expectations (`*.controller.spec.ts`)

Mirror [`create-employee.controller.spec.ts`](../../../src/modules/employees/presentation/controllers/create-employee.controller.spec.ts) + [`get-employees.controller.spec.ts`](../../../src/modules/employees/presentation/controllers/get-employees.controller.spec.ts):

- `makeStubs` / `makeSut` / `SutTypes`
- Port stub: `execute: jest.fn().mockResolvedValue({ id, status })` + `satisfies UpdateEmployeeStatusPort`
- Do **not** hit Mongo, Express, or the real use case
- Do **not** add a route/module unit spec — coverage already excludes those files; wiring is verified by TypeScript + the checklist below

Required cases:

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdateEmployeeStatusController` |
| `should return 400 if id is not provided` | empty/`''` id → `MissingParamError('id')`; port **not** called |
| `should return 400 if status is not provided` | empty/`''` status → `MissingParamError('status')`; port **not** called |
| `should return 400 when status is invalid` | e.g. `'active'` or `'ROOT'` → `{ error: 'Invalid param status' }`; port **not** called |
| `should accept ACTIVE, INACTIVE and VACATION` | `it.each` over `EmployeeModel.Status`; port called with that status |
| `should call UpdateEmployeeStatusPort with correct values` | `{ id, status }` forwarded as-is after validation |
| `should return 500 if UpdateEmployeeStatusPort throws` | status `500` + `{ error: '<message>' }` |
| `should return 200 if employee status is updated successfully` | `{ data: { id, status } }` matching the stub result |

Do **not** test auth middleware or domain transition rules here.

## Checklist (agent)

- [ ] Controller is Express-free (`presentation/` must not `import 'express'`)
- [ ] Injects inbound port only; never instantiates the use case or repository
- [ ] Required fields: `id`, `status` → `MissingParamError`
- [ ] `status` validated with `EmployeeModel.isStatus` → `InvalidParamError`
- [ ] Success uses `ok(...)` (`200`), not `created(...)`
- [ ] Unexpected throws → `serverError`
- [ ] Co-located `*.controller.spec.ts` covers the table above
- [ ] `makeEmployeeRoutes` registers `POST /employee/update-status` with `authTokenMiddleware` + `adaptRoute`
- [ ] Routes factory takes the real controller (no local stub class)
- [ ] `makeEmployeesModule` constructs the controller and passes it into `makeEmployeeRoutes`
- [ ] Temporary `UpdateEmployeeStatusPort` in the module until the use-case spec
- [ ] `makeApp` still exposes the route as `POST /api/employee/update-status` (no duplicate mount)
- [ ] `employee.http` + employees `AGENT.md` updated
- [ ] No `activate` / `deactivate` / `putOnVacation` / mapper / schema changes

## Out of scope

- Use case orchestration (load employee, call entity methods, persist)
- Outbound ports / repository `update` / `findById`
- HTTP mapping of `EmployeeNotFoundError` / already-in-status domain errors
- Authorization beyond token presence (who may change whose status)

## Acceptance criteria

- [ ] `handle({ id, status: 'INACTIVE' })` with a succeeding stub → `200` + `{ data: { id, status: 'INACTIVE' } }`
- [ ] Missing `id` or `status` → `400` + `MissingParamError`; port not called
- [ ] `status: 'active'` (or any non-enum) → `400` + `InvalidParamError('status')`; port not called
- [ ] `ACTIVE` / `INACTIVE` / `VACATION` are forwarded to the port
- [ ] Port rejection → `500` with the thrown message
- [ ] `update-employee-status.controller.spec.ts` passes in isolation
- [ ] `POST /api/employee/update-status` is registered through `makeEmployeeRoutes` → `makeEmployeesModule` → `makeApp` (works even if the route did not exist before this spec)
- [ ] Unauthenticated request is rejected by `authTokenMiddleware` (same as create/list)

## Open decisions

1. **Domain error → HTTP status** — keep coarse `serverError` (this slice). Mapping `EmployeeNotFoundError` → `404` and already-in-status → `400`/`409` waits for a later spec; do not invent `notFound(...)` here unless that spec lands first.
2. **Success body** — `{ id, status }` only. Do **not** return the list read model or `toCreate` (no password, no extra write snapshot). Expanding the body belongs to a get-by-id feature.

## Reference map

| Concern | Look at |
|---------|---------|
| Required-field + `created`/`serverError` | `create-employee.controller.ts` |
| `status` enum validation | `get-employees.controller.ts` (`EmployeeModel.isStatus`) |
| Raw HTTP vs application DTO | `presentation/http/get-employees.request.ts` |
| Controller test harness | `create-employee.controller.spec.ts` |
| Status enum | `domain/models/employee.model.ts` |
| Response helpers | `@shared/presentation/helpers/http-helper` |
| Routes factory | `infrastructure/inbound/http/employee.routes.ts` |
| Module composition | `employees.module.ts` |
| API mount | `src/app.ts` (`app.use('/api', employees.router)`) |
| Next slice | [`usecase.md`](./usecase.md) |
