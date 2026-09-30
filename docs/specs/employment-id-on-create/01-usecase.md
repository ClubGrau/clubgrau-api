# Spec: Slice 1 — `CreateEmployeeUsecase` issues Employment Id

> Create persists a server-issued `employmentId`.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-persistence.md`](./00-persistence.md).  
> Next: [`02-http-and-contract.md`](./02-http-and-contract.md).

## Responsibility (this spec only)

`CreateEmployeeUsecase` allocates the Employment Id after the create candidate is valid, the email is free, and the password is encrypted. The insert snapshot carries that string. The Create result stays `{ id }`.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-persistence.md) | `AllocateEmploymentIdPort` |
| **This file** | Use case order, module wiring, use-case spec |
| [`02`](./02-http-and-contract.md) | Controller stops forwarding the body field; DTO field removed; living docs |

Leave `employmentId?` on `CreateEmployeeDto` and on the controller payload until slice 2, so this slice compiles while the HTTP gate still sends the body value. The use case **must not read** `params.employmentId`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `CreateEmployeeUsecase` + spec | Yes |
| `makeEmployeesModule` constructs `EmploymentIdCounter` and injects the port | Yes |
| `CreateEmployeeDto.employmentId` | **Leave it** — slice 2 removes it |
| Controller / route / `.http` / `AGENT.md` / `CONTEXT.md` | **No** |
| Entity mutator | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Employment Id on Create following [`docs/specs/employment-id-on-create/01-usecase.md`](./01-usecase.md).  
> After email occupancy and encrypt, call `AllocateEmploymentIdPort.allocate()` and persist that string. Do not read `params.employmentId`.  
> Wire the counter in `makeEmployeesModule`. Do not change the controller or the living docs.

## Use case flow (normative)

Constructor — append the port; do not reorder the existing arguments:

```ts
constructor(
  employeePoliciesService: EmployeePoliciesService,
  encrypter: EncrypterPort,
  createEmployeeRepository: CreateEmployeeRepositoryPort,
  allocateEmploymentId: AllocateEmploymentIdPort,
)
```

Order. Stop at the first throw. Call `allocate()` only at step 5.

1. `password !== passwordConfirmation` → `PasswordNotMatchError`. Do not allocate.
2. `Employee.create(...)` then `.toJSON()`. Omit `employmentId` (do not pass `params.employmentId`). VO failures (`Email`, `Phone`, `Password`, `Nif`, role) happen here. Do not allocate.
3. `employeePoliciesService.ensureEmailIsAvailable(email)`. On `EmployeeAlreadyExistsError` / `EmployeeInactiveError`, do not allocate.
4. `encrypter.encrypt(password)`. If encrypt throws, do not allocate.
5. `const employmentId = await allocateEmploymentId.allocate()`.
6. `createEmployeeRepository.create({ ...candidate, password: encryptedPassword, employmentId })`.
7. Return `{ id }`.

Step 6 is the birth of the field on the document. Do not add `Employee.assignEmploymentId`. The in-memory entity from step 2 still has `employmentId: null`; the object passed to the repository overwrites that key.

If step 6 throws, the number from step 5 is spent. Do not catch the error to allocate again, and do not ask the counter to roll back.

Profile fields other than `employmentId` stay forwarded: `username`, `gender`, `address`, `languages`, `emergencyContact`, `jobTitle`.

## Module

In `makeEmployeesModule`:

```ts
const employmentIdCounter = new EmploymentIdCounter(employeeModel, counterModel)
const createEmployee = new CreateEmployeeUsecase(
  employeePoliciesService,
  encrypter,
  employeeRepository,
  employmentIdCounter,
)
```

Register the counter model with `connection.model` next to the employee model. Reuse the same `employeeModel` instance for the max query and for the repository.

## Files

| File | Action |
|------|--------|
| `application/usecases/create-employee.usecase.ts` | Issue at step 5; stop reading `params.employmentId` |
| `application/usecases/create-employee.usecase.spec.ts` | Cover allocate timing and the persisted string |
| `employees.module.ts` | Construct and inject `EmploymentIdCounter` |
| DTO, controller, schema, repository `create` | Do not change |

## Spec expectations (`create-employee.usecase.spec.ts`)

Mock `AllocateEmploymentIdPort`. Existing password, encrypt, and occupancy cases stay. Update the case that forwards `employmentId: 'HR-001'` into `Employee.create`: that call must not receive `'HR-001'`.

| `it(...)` | Assert |
|-----------|--------|
| happy path | `allocate` called once; `repository.create` receives `employmentId` equal to the stub string and `password` equal to the hash |
| params include `employmentId: 'HR-001'` | `Employee.create` and `repository.create` do not receive `'HR-001'`; persisted `employmentId` is the stub |
| password mismatch | `allocate` not called |
| `Employee.create` throws (invalid email or phone) | `allocate` not called |
| `ensureEmailIsAvailable` throws | `allocate` not called |
| `encrypt` throws | `allocate` not called |
| `repository.create` throws | `allocate` called once; the rejection propagates |

`jobTitle` and the other profile fields are still forwarded on the same path.

## Checklist (agent)

- [ ] `allocate()` sits after occupancy and encrypt, before `repository.create`
- [ ] Early failures do not allocate
- [ ] Insert failure does not allocate a second time and does not roll the counter back
- [ ] `params.employmentId` is never read
- [ ] Result is still `{ id }`
- [ ] Module injects the counter into Create only
- [ ] Controller and living docs untouched

## Out of scope

- Removing `employmentId` from `CreateEmployeeDto` / the controller
- `employee.http`, `AGENT.md`, `CONTEXT.md`
- Backfill

## Acceptance criteria

- [ ] Persisted `employmentId` is the allocated digit string
- [ ] A body value `HR-001` is not stored
- [ ] Occupancy and validation failures leave the counter untouched
- [ ] A failed insert spends the allocated number and surfaces the insert error
- [ ] Use-case spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Current flow | `application/usecases/create-employee.usecase.ts` |
| Issuer | [`00-persistence.md`](./00-persistence.md) |
| Module factory | `employees.module.ts` |
| Next slice | [`02-http-and-contract.md`](./02-http-and-contract.md) |
