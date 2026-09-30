# Spec: Slice 2 — HTTP gate + living contract

> Create ignores a client `employmentId`. Living employees docs match the closed shape.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`01-usecase.md`](./01-usecase.md).  
> Next: none.

## Responsibility (this spec only)

The Create HTTP body may still contain `employmentId`. The controller does not forward it. The success body stays `{ id }`. `AGENT.md` and `CONTEXT.md` record the rule. No new route.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-persistence.md)–[`01`](./01-usecase.md) | Issuer and use case already shipped |
| **This file** | DTO field removed, controller gate, `.http` note, living contract |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `CreateEmployeeDto` — drop `employmentId` | Yes |
| `CreateEmployeeController` — do not pass the body field | Yes |
| Controller spec + DTO spec | Yes |
| `CreateEmployeeRequest.employmentId` | Keep, marked ignored (same idea as `status`) |
| `src/client/employee.http` | Comment only — Create sample may still send the field |
| `employees/AGENT.md` | Yes — Create section, directory map, open decision |
| `employees/CONTEXT.md` | Yes — **Employment Id** entry |
| Route, role gate, response shape | **No** |
| `CONTEXT-MAP.md`, root `AGENTS.md` | **No** |
| Historical professional PRD / design / specs | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Employment Id on Create following [`docs/specs/employment-id-on-create/02-http-and-contract.md`](./02-http-and-contract.md).  
> Drop `employmentId` from `CreateEmployeeDto` and from the controller payload. `201` stays `{ id }`. A body `employmentId` is ignored, not `400`.  
> Update `employee.http`, `employees/AGENT.md`, and `employees/CONTEXT.md`. Do not add a PRD or a design doc.

## HTTP

`POST /api/employee` is unchanged: `authTokenMiddleware`, `requireRoles('ADMIN', 'MANAGER')`, `201` `{ data: { id } }` via `created({ id: result.id })`.

| Body | Result |
|------|--------|
| no `employmentId` | `201`; stored value is the issued digit string |
| `employmentId: "HR-001"` (or any other value) | `201`; that value is not forwarded and not stored |
| missing name / email / password / passwordConfirmation | `400` as today |

Do not validate the body `employmentId`. Do not map it to `400`.

### Request type

`presentation/http/create-employee.request.ts` keeps `employmentId?: string | null` so the raw body shape stays visible. Extend the file comment: the controller discards `status` and `employmentId`.

### DTO

Remove `employmentId` from `CreateEmployeeDto`. After this slice the use case cannot receive a client registration number.

### Controller

Delete the `employmentId: request.employmentId ?? null` argument. Forward the other optional profile fields as today.

## Client file

In `src/client/employee.http`, on the Create request, state that `employmentId` in the body is ignored and that the server stores the issued digit string. The sample may keep `"employmentId": "HR-001"` so the ignore rule stays visible. Do not add a new request just to read the number back; the list already returns it.

## Living contract

### `CONTEXT.md` — replace the **Employment Id** entry

```markdown
**Employment Id**:
The collaborator's registration number (`employmentId`). Create issues it: a positive integer from 1, no leading zeros, stored as a digit string. The client does not supply it; a value sent on Create is ignored. Issued numbers are unique and are not reused, including after Remove. A gap may remain when issuance succeeds and the employee insert does not. No later command rewrites it. Update Professional Employee Data does not write it. Remove keeps it.
_Avoid_: client-supplied matrícula, updating matrícula on professional save, treating it as Job Title, reusing a number after Remove, backfilling legacy values
```

Leave the Professional Employee Data and Update Professional Employee Data entries as they are: they already say this command does not write Employment Id.

### `AGENT.md`

Update in place. Do not append a changelog.

| Section | Change |
|---------|--------|
| Directory map | Add `allocate-employment-id.port.ts`, `employment-id-counter.schema.ts`, `employment-id-counter.mongoose.ts` |
| Create DTO block | Remove `employmentId` from `CreateEmployeeDto` |
| Create use case flow | Steps match slice 1: validate, occupancy, encrypt, `allocate()`, persist the issued string, return `{ id }` |
| Create request comment in the directory map | Body `employmentId` ignored, same as `status` |
| Open decisions | Keep item 14 (professional command does not write it). Add that Create now issues the digit string, legacy non-digits and `null` are left in place, and there is no backfill and no unique index |
| `Employee.create` optional profile line | Create command passes the issued string into the insert snapshot; it does not take the number from the client |

Do not describe a Create response field `employmentId`.

## Files

| File | Action |
|------|--------|
| `application/dtos/create-employee.dto.ts` | Remove `employmentId` |
| `application/dtos/create-employee.dto.spec.ts` | Drop the expectation that the DTO keeps `HR-001` |
| `presentation/controllers/create-employee.controller.ts` | Do not forward `employmentId` |
| `presentation/controllers/create-employee.controller.spec.ts` | Body `employmentId` is absent from `execute` |
| `presentation/http/create-employee.request.ts` | Comment: field ignored |
| `src/client/employee.http` | Comment on the Create sample |
| `employees/AGENT.md` | Sections in the table above |
| `employees/CONTEXT.md` | **Employment Id** entry |
| Routes, schema, professional command | Do not change |

## Spec expectations

| Case | Assert |
|------|--------|
| Create body includes `employmentId: 'HR-001'` plus the required fields | `execute` payload has no `employmentId`; response `201` `{ id }` |
| Create body omits `employmentId` | same success shape |
| DTO spec | no `employmentId` property |

Use-case spec from slice 1 may still pass `employmentId` on the DTO object. Once the property is gone, delete that input from the use-case spec and keep the assertion that the persisted value is the allocated string.

## Checklist (agent)

- [ ] Controller does not forward `employmentId`
- [ ] Extra body field is not `400`
- [ ] `201` body is still `{ id }`
- [ ] DTO no longer has `employmentId`
- [ ] `CONTEXT.md` **Employment Id** matches the block above
- [ ] `AGENT.md` Create flow describes `allocate()` and the ignored body field
- [ ] No PRD, no design doc, no `CONTEXT-MAP.md` / root `AGENTS.md` edit

## Out of scope

- Backfill
- Unique index
- Get-by-id
- Changing professional / main / personal / status / remove writes

## Acceptance criteria

- [ ] `POST /api/employee` with `employmentId: "HR-001"` returns `201 { id }` and does not pass that string into the use case
- [ ] List still exposes whatever `employmentId` is stored, including legacy non-digits and new digit strings
- [ ] `employees/AGENT.md` and `employees/CONTEXT.md` describe server-issued Employment Id
- [ ] Controller spec and DTO spec pass

## Reference map

| Concern | Look at |
|---------|---------|
| Current controller | `presentation/controllers/create-employee.controller.ts` |
| Ignored `status` comment | `presentation/http/create-employee.request.ts` |
| Glossary entry to replace | `employees/CONTEXT.md` **Employment Id** |
| Create contract to edit | `employees/AGENT.md` section **Application: Create Employee** |
| Professional command stays | open decision 14 in `AGENT.md` |
