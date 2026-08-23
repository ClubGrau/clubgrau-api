# Spec: Slice 5 — List operational filter + living `AGENT.md`

> Close the HTTP list hole and rewrite the employees contract so it matches shipped code.  
> Parent: [`README.md`](./README.md).  
> Depends on: slices [`00`](./00-adapt-route-and-http-helpers.md)–[`04`](./04-remove-employee.md) (repo already excludes `REMOVED`).  
> Design §8.3 / §9 / §14 last row / [ADR 0004](../../adr/remove-or-inactivate-emp/0004-removed-absent-from-list.md) / [ADR 0013](../../adr/remove-or-inactivate-emp/0013-removed-is-a-status-enum-value.md).

## Responsibility (this spec only)

1. `GET /api/employees?status=REMOVED` → `400` (operational statuses only).
2. `AGENT.md` becomes the **live** contract (Remove shipped; HTTP map; wiring; open decisions).
3. Record the Auth follow-up; do **not** implement JWT re-check.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-persistence.md) | `findAll` already ANDs `status ≠ REMOVED` |
| [`04`](./04-remove-employee.md) | Remove HTTP exists |
| **This file** | List controller guard + module contract docs |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `GetEmployeesController` uses `isOperationalStatus` | Yes |
| `GetEmployeesDto.status` typed as `OperationalStatus` | Yes (honesty; query does not accept `REMOVED`) |
| `get-employees.controller.spec.ts` | Yes — `REMOVED` → `400` |
| `src/modules/employees/AGENT.md` | Yes — full contract pass |
| `src/client/employee.http` | Yes — list samples stay operational; no `status=REMOVED` example (or a commented “must 400”) |
| Auth middleware re-read of current status | **No** — document only |
| `GetEmployeesQuery` logic | **No** change unless DTO type forces a trivial import |
| Policy / Remove use case | **No** |

**Prompt sketch for the agent:**

> Implement slice 5 of employee lifecycle following [`docs/specs/employee-lifecycle/05-list-and-module-contract.md`](./05-list-and-module-contract.md).  
> `GetEmployeesController` must validate `status` with `isOperationalStatus` so `?status=REMOVED` is `400`.  
> Rewrite `employees/AGENT.md` to the shipped contract. Document JWT re-check as an Auth follow-up; do not implement it.

## List controller (normative)

File: `presentation/controllers/get-employees.controller.ts`.

Today `normalizeFilters` uses `EmployeeModel.isStatus`. After slice 1 that accepts `REMOVED`.

Change to:

```ts
if (!EmployeeModel.isOperationalStatus(request.status)) {
  return new InvalidParamError('status')
}
```

`ACTIVE` / `INACTIVE` / `VACATION` still forward. Empty / omitted `status` still means “no equality filter” (repository still excludes `REMOVED`).

`GetEmployeesDto.status` and `FindEmployeesParams.status`: `EmployeeModel.OperationalStatus | undefined`.

Do not add `removedAt` to `GetEmployeesItemDto`.

`GetEmployeesQuery` stays a pass-through of filters + pagination. No entity, no policy, no encrypter.

## Spec expectations (`get-employees.controller.spec.ts`)

Keep existing cases. Add / adjust:

| `it(...)` | Assert |
|-----------|--------|
| `should return 400 when status is REMOVED` | `{ error: 'Invalid param status' }`; port **not** called |
| `should accept ACTIVE, INACTIVE and VACATION` | `it.each(OPERATIONAL_STATUSES)` or three cases; port called |
| invalid `'active'` | still `400` (already exists) |

Do not assert repository `$ne` here — that is slice 2.

## `employee.http`

Keep list samples on operational statuses only. Optional commented request:

```http
### List employees (REMOVED is rejected)
# GET http://localhost:3003/api/employees?status=REMOVED
# → 400 Invalid param status
```

## `AGENT.md` (living contract)

Do **not** treat this as a changelog. Rewrite in place so a new agent can extend the hexagon from the file alone.

Sections that must match **shipped** code after slices 0–5:

1. **Module status** — Remove is Done (`POST /api/employee/remove`). Drop “designed, not shipped”.
2. **Directory map** — policy, lifecycle errors, Remove files, `removedAt`, new ports.
3. **Domain** — `Status` includes `REMOVED`; `isOperationalStatus`; `anonymize()`; `EmployeeLifecyclePolicy` + `CountNonRemovedAdminsPort`; new errors. Keep `EmployeePoliciesService` as **email occupancy only**.
4. **Update-status command** — `actorId` on DTO; policy before transition; HTTP `400`/`401`/`403`/`409`.
5. **Remove command** — ports, flow, anonymize `$set`, HTTP. No “planned”.
6. **Get Employees** — `isOperationalStatus`; `findAll` excludes `REMOVED`; `total` on the filtered set.
7. **HTTP / routes** — four routes; `adaptRoute` stamps `actorId`; do not send `actorId` in bodies.
8. **Persistence** — enum + `removedAt`; `countNonRemovedAdmins`; `anonymize`; list exclusion; `findById`/`findByEmail` unchanged.
9. **Wiring** — `compareHash`; policy constructed once; injected into update-status **and** Remove.
10. **Sequences** — update-status, Remove, list (design §13).
11. **Open decisions**
    - Inactive email: occupied until Remove; then Create is a **new** id. Code matches product.
    - Authorization matrix: **enforced** in `EmployeeLifecyclePolicy` (no longer “token presence only” for lifecycle).
    - Error HTTP mapping: lifecycle table is closed; create-path may still be coarse `serverError`.
    - **Session after INACTIVE / REMOVED / VACATION** — still Auth. Existing JWT remains valid until expiry unless auth re-checks current status after decode → `401`. **Do not implement in employees.** Login already refuses `status !== ACTIVE`.
    - Create-employee **who may create which role** — still out of scope.

Glossary stays in `CONTEXT.md`. Do not duplicate ADR text; link the folder.

## Auth follow-up (document only)

Add a short note in `AGENT.md` open decisions (and nowhere else as a fake TODO in code):

> Auth sibling: after `authTokenMiddleware` decodes the JWT, re-load the employee (or equivalent) and refuse `status !== ACTIVE` with opaque `401`. Product: inactive / removed / vacation must not keep using the API. This feature does not blacklist tokens.

Do not edit the auth hexagon in this slice.

## Files

| File | Action |
|------|--------|
| `presentation/controllers/get-employees.controller.ts` + `*.spec.ts` | `isOperationalStatus` |
| `application/dtos/get-employees.dto.ts` (+ spec if it assigns `REMOVED`) | Operational status on filters |
| `src/modules/employees/AGENT.md` | Living contract |
| `src/client/employee.http` | List samples / optional 400 comment |
| Auth module / middleware | Do not change |
| Design doc / PRD / ADRs | Do not rewrite; they remain the product/shape source |

## Checklist (agent)

- [ ] `?status=REMOVED` → `400`; port not called
- [ ] `ACTIVE` / `INACTIVE` / `VACATION` still filter
- [ ] Omitted status still lists operational rows only (repo exclusion)
- [ ] `AGENT.md` describes shipped Remove + policy + HTTP codes + wiring
- [ ] Auth re-check is an open decision, not code
- [ ] No new module; no hard delete; no audit list of `REMOVED`

## Out of scope

- Implementing JWT re-check / token version / blacklist
- `?status=REMOVED` as an admin audit API
- Create authorization matrix
- Behaviour of other contexts when they store a `REMOVED` `employeeId`

## Acceptance criteria

- [ ] `GET /api/employees?status=REMOVED` → `400` `{ error: 'Invalid param status' }`
- [ ] After a successful Remove, `GET /api/employees` omits that id (repo + no REMOVED filter)
- [ ] `GET /api/employees?status=INACTIVE` still returns inactivated collaborators who were **not** Removed
- [ ] `get-employees.controller.spec.ts` covers `REMOVED`
- [ ] `AGENT.md` can be followed without reading “planned” Remove as if it were future work
- [ ] Auth sources unchanged

## Feature acceptance (all slices — smoke)

Mirrors design §16 / PRD §7 at the HTTP boundary. Confirm or tick in `AGENT.md` only as behaviour, not as a checklist dump:

- MANAGER + `INACTIVE` `EMPLOYEE` → Reactivate `200`; Remove `403`
- ADMIN + `INACTIVE` `EMPLOYEE` + correct password → Remove `200`; list omits them; Create with old email succeeds as new id
- ADMIN + wrong password → `401`; no persist
- Remove while `ACTIVE` / `VACATION` → `409`
- MANAGER + Target `MANAGER` or `ADMIN` (any lifecycle intent) → `403`
- Last Admin + Deactivate / Vacation / Remove → `409`
- Two ADMINs: A Removes `INACTIVE` B → `200`; A remains non-`REMOVED` ADMIN
- Body `actorId` ignored / overwritten by JWT
- `update-status` `{ status: "REMOVED" }` → `400`
- `GET /api/employees?status=REMOVED` → `400`

## Reference map

| Concern | Look at |
|---------|---------|
| List controller today | `get-employees.controller.ts` |
| List query | `get-employees.query.ts` |
| Repo exclusion | slice 2 `buildFindFilter` |
| Module contract | `src/modules/employees/AGENT.md` |
| Constitution | `AGENTS.md` |
| Design sequences | `docs/design-docs/employee-lifecycle-v1.md` §13–§16 |
