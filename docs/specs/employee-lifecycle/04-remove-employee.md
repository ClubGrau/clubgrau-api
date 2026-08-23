# Spec: Slice 4 — `RemoveEmployee` (command)

> New command: Anonymize from `INACTIVE`, ADMIN-only, Actor password step-up.  
> Parent: [`README.md`](./README.md).  
> Depends on: slices [`00`](./00-adapt-route-and-http-helpers.md)–[`03`](./03-update-employee-status.md).  
> Design §8.2 / §9 / §12 / [ADR 0001](../../adr/remove-or-inactivate-emp/0001-employee-remove-is-anonymization.md) / [ADR 0002](../../adr/remove-or-inactivate-emp/0002-only-admin-may-remove.md).  
> Next: [`05-list-and-module-contract.md`](./05-list-and-module-contract.md).

## Responsibility (this spec only)

Ship `POST /api/employee/remove` through the hexagon: DTO → ports → use case → controller → route → module → `.http`.

| Spec | Responsibility |
|------|----------------|
| [`01`](./01-domain.md) | `anonymize()` + policy `REMOVE` |
| [`02`](./02-persistence.md) | `repository.anonymize` + count |
| [`03`](./03-update-employee-status.md) | Same policy instance already wired for update-status |
| **This file** | Remove vertical slice |
| [`05`](./05-list-and-module-contract.md) | List HTTP + full `AGENT.md` |

## When to use this spec

Follow the constitution **new command** playbook. Reuse `FindEmployeeByIdPort`, `EmployeeLifecyclePolicy`, `EncrypterPort`, and `CompareHashPort`. Do not hard-delete. Do not revoke JWTs.

| Artifact | This slice? |
|----------|-------------|
| DTO + inbound port + anonymize outbound port | Yes |
| `RemoveEmployeeUsecase` + spec | Yes |
| Controller + spec + request type | Yes |
| Route `POST /employee/remove` | Yes |
| `makeEmployeesModule({ compareHash })` + `app.ts` pass `bcryptAdapter` | Yes |
| `.http` sample | Yes |
| `AGENT.md` Remove section from “planned” → live command | Yes (slice 5 may still polish list/status) |
| Policy / `anonymize()` entity / schema | **No** — already shipped |
| List controller `isOperationalStatus` | **No** — slice 5 |
| Auth JWT re-check | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of employee lifecycle following [`docs/specs/employee-lifecycle/04-remove-employee.md`](./04-remove-employee.md).  
> Add `RemoveEmployeeUsecase`: Actor from JWT, step-up via `CompareHashPort`, `assertCan(REMOVE)`, encrypt a random secret, `Employee.anonymize()`, `$set` via `AnonymizeEmployeeRepositoryPort`.  
> HTTP `POST /api/employee/remove` `{ id, password }`. Wire `compareHash` from `app.ts` (same `BcryptAdapter`).  
> Do not change list validation; do not revoke JWTs.

## HTTP surface

```http
POST /api/employee/remove
Authorization: Bearer <Actor token>
Content-Type: application/json

{ "id": "<Target>", "password": "<Actor password>" }
```

| Item | Contract |
|------|----------|
| Auth | Route uses `authTokenMiddleware` (same as the others) |
| Body | `id` (Target), `password` (Actor). **No** `actorId`, **no** `passwordConfirmation`, **no** Target name |
| Success | `200` + `{ data: { id } }` via `ok(...)` (not `201`) |
| Missing `id` or `password` | `400` + `MissingParamError` |
| Actor password / Actor missing / Actor not `ACTIVE` | `401` `{ error }` opaque (`Authentication failed`) |
| Matrix refusal (MANAGER Remove, EMPLOYEE, etc.) | `403` |
| Last Admin / Target not `INACTIVE` / already `REMOVED` | `409` |
| Target id miss | `400` `Employee not found` |
| Unexpected | `500` |

Do **not** send `actorId` in `.http`. Ignore it if a client sends it; the adapter overwrites it.

## Application contracts

### DTO — `application/dtos/remove-employee.dto.ts`

```ts
interface RemoveEmployeeDto {
  actorId: string        // JWT
  targetId: string       // body.id
  actorPassword: string  // body.password
}

interface RemoveEmployeeResultDto {
  id: string
}
```

No DTO `*.spec.ts` required (same as update-status).

### Inbound — `application/ports/inbound/remove-employee.port.ts`

```ts
interface RemoveEmployeePort {
  execute(params: RemoveEmployeeDto): Promise<RemoveEmployeeResultDto>
}
```

### Outbound — `application/ports/outbound/anonymize-employee-repository.port.ts`

Create here if slice 2 did not. Repository already has the method.

```ts
interface AnonymizeEmployeeParams {
  id: string
  name: string
  email: string
  phone: null
  nif: null
  password: string
  status: EmployeeModel.Status.REMOVED
  removedAt: Date
}

interface AnonymizeEmployeeRepositoryPort {
  anonymize(params: AnonymizeEmployeeParams): Promise<void>
}
```

## Use case flow (normative)

`RemoveEmployeeUsecase` implements `RemoveEmployeePort`.

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  compareHash: CompareHashPort,
  encrypter: EncrypterPort,
  lifecyclePolicy: EmployeeLifecyclePolicy,
  anonymizeEmployee: AnonymizeEmployeeRepositoryPort,
)
```

```text
execute({ actorId, targetId, actorPassword })
  1. blank actorId → ActorAuthenticationFailedError
  2. actorSnapshot = findById(actorId); null → ActorAuthenticationFailedError
  3. compareHash.compare(actorPassword, actorSnapshot.password)
        false or throw → ActorAuthenticationFailedError
        (opaque; do not leak “wrong password”)
  4. targetSnapshot = findById(targetId); null → EmployeeNotFoundError
  5. reconstitute Actor + Target (Password.fromHash; removedAt ?? null)
  6. await lifecyclePolicy.assertCan({ actor, target, intent: 'REMOVE' })
  7. secret = crypto.randomBytes(32).toString('hex')   // application layer
     hash   = await encrypter.encrypt(secret)
  8. target.anonymize()
     target.changePassword(Password.fromHash(hash))
  9. anonymizeEmployee.anonymize({
        id: target.id,
        name, email, phone: null, nif: null,   // from target.toJSON() for name/email
        password: hash,                         // NEVER toJSON().password
        status: REMOVED,
        removedAt: target.toJSON().removedAt,
     })
 10. return { id: target.id }
```

Rules:

- Step 3 **before** loading the Target so a wrong password does not probe Target existence beyond the JWT Actor.
- If 1–8 throw, **do not** call `anonymize`.
- Do **not** persist `employee.toJSON()` as a full document.
- Do **not** hash inside the entity.
- `crypto` stays in the use case (Node). Do not add a “random bytes” port.
- Same `EmployeeLifecyclePolicy` instance style as update-status (module constructs one policy, injects into both commands).

Compare uses the snapshot hash (`actorSnapshot.password`), not `Password.toJSON()`.

## Presentation

### Request — `presentation/http/remove-employee.request.ts`

```ts
export type RemoveEmployeeRequest = {
  id?: string
  password?: string
  actorId?: string
}
```

### Controller

`RemoveEmployeeController` extends `BaseController`. Inject `RemoveEmployeePort` only.

1. Required: `id`, `password` → `MissingParamError`.
2. `execute({ actorId: String(request.actorId ?? ''), targetId: String(id), actorPassword: String(password) })`.
3. Success → `ok({ id: result.id })`.
4. `catch` map:

| Error | Helper |
|-------|--------|
| `ActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `EmployeeLifecycleForbiddenError` | `forbidden` (`403`) |
| `LastAdminProtectedError` | `conflict` (`409`) |
| `EmployeeNotInactiveError` | `conflict` (`409`) |
| `EmployeeAlreadyRemovedError` | `conflict` (`409`) |
| `EmployeeNotFoundError` | `badRequest` (`400`) |
| else | `serverError` (`500`) |

No VO / policy / bcrypt in the controller.

### Route

```ts
router.post(
  '/employee/remove',
  authTokenMiddleware,
  adaptRoute(removeEmployeeController),
)
```

Add `removeEmployeeController` to `EmployeeRoutesDependencies`. Public path: `POST /api/employee/remove`.

## Wiring

`makeEmployeesModule({ connection, encrypter, compareHash, authTokenMiddleware })`.

`app.ts`:

```ts
const employees = makeEmployeesModule({
  connection,
  encrypter: bcryptAdapter,
  compareHash: bcryptAdapter,
  authTokenMiddleware: auth.authTokenMiddleware,
})
```

Same `BcryptAdapter` instance Auth already uses for compare. Employees previously received only `encrypt`.

Composition (extend today’s factory):

1. Model + repository (already implements count + anonymize)
2. `EmployeePoliciesService` (email)
3. `EmployeeLifecyclePolicy(repository)` — **reuse** the instance from slice 3
4. Create / Get / Update-status (update-status already has the policy)
5. `RemoveEmployeeUsecase(find, compareHash, encrypter, lifecyclePolicy, repository)`
6. `RemoveEmployeeController` + route

## `.http`

Add:

```http
### Remove employee (anonymize)
POST http://localhost:3003/api/employee/remove
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "id": "<target-inactive-id>",
  "password": "P@ssword123"
}
```

No `actorId` in the JSON.

## Files

| File | Action |
|------|--------|
| `application/dtos/remove-employee.dto.ts` | Create |
| `application/ports/inbound/remove-employee.port.ts` | Create |
| `application/ports/outbound/anonymize-employee-repository.port.ts` | Create if missing |
| `application/usecases/remove-employee.usecase.ts` + `*.spec.ts` | Create |
| `presentation/http/remove-employee.request.ts` | Create |
| `presentation/controllers/remove-employee.controller.ts` + `*.spec.ts` | Create |
| `infrastructure/inbound/http/employee.routes.ts` | Register route |
| `employees.module.ts` | `compareHash` dep + use case + controller |
| `src/app.ts` | Pass `compareHash: bcryptAdapter` |
| `src/client/employee.http` | Sample |
| `src/modules/employees/AGENT.md` | Remove is shipped (HTTP, ports, flow) |
| Entity / policy / schema | Do not reimplement |

## Spec expectations

### `remove-employee.usecase.spec.ts`

Mirror create/update-status harness. Stubs: findById (Actor vs Target), `CompareHashPort`, `EncrypterPort`, policy, anonymize repo.

Defaults: Actor ADMIN ACTIVE; Target EMPLOYEE INACTIVE; `compare` → `true`; `encrypt` → `'hashed-random'`; `assertCan` resolves.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `RemoveEmployeeUsecase` |
| blank / missing actorId | `ActorAuthenticationFailedError`; anonymize **not** called |
| Actor find null | same `401` error; compare **not** required; anonymize not called |
| `compare` false | `ActorAuthenticationFailedError`; Target find **not** called; anonymize not called |
| Target find null (after successful compare) | `EmployeeNotFoundError`; anonymize not called |
| `assertCan` called with `REMOVE` | `{ intent: 'REMOVE' }` |
| policy forbidden / Last Admin / not inactive / already removed | propagate; anonymize not called |
| success | `anonymize` `$set` payload: sentinel name/email, `phone: null`, `nif: null`, `password: 'hashed-random'`, `status: REMOVED`, `removedAt` Date, **same id** |
| `encrypt` called with a random secret (not the Actor password, not the Target old hash) | argument ≠ `actorPassword` |
| `Password.fromHash` used for the new hash; `toJSON().password` not persisted | payload password is the encrypter result |
| return `{ id: targetId }` | |
| `compare` called with `(actorPassword, actorSnapshot.password)` | |
| repository anonymize errors propagate | |

Spy `crypto.randomBytes` if you need a deterministic secret; optional.

### `remove-employee.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| defined | instance |
| missing `id` / `password` | `400`; port not called |
| forwards `{ actorId, targetId: id, actorPassword: password }` | |
| success | `200` `{ data: { id } }` |
| `ActorAuthenticationFailedError` | `401` |
| `EmployeeLifecycleForbiddenError` | `403` |
| `LastAdminProtectedError` / `EmployeeNotInactiveError` / `EmployeeAlreadyRemovedError` | `409` |
| `EmployeeNotFoundError` | `400` |
| generic | `500` |

## Checklist (agent)

- [ ] Actor from JWT; password is the Actor’s; Target id in the body
- [ ] Wrong password → opaque `401`; no persist
- [ ] Policy `REMOVE` before `anonymize()`
- [ ] Partial `$set`; never full `toJSON()` write
- [ ] Random secret hashed via `EncrypterPort`
- [ ] `compareHash` injected from `app.ts`
- [ ] Route behind `authTokenMiddleware` + `adaptRoute`
- [ ] Co-located use-case + controller specs
- [ ] `.http` + `AGENT.md` updated
- [ ] No hard delete; no JWT revoke; no list-controller change

## Out of scope

- `GET ?status=REMOVED` → `400` (slice 5)
- Downstream modules holding `employeeId`
- Audit UI
- Create-employee role matrix

## Acceptance criteria

- [ ] ADMIN + INACTIVE EMPLOYEE + correct Actor password → `200` `{ data: { id } }`; document anonymized
- [ ] ADMIN + wrong password → `401`; no write
- [ ] MANAGER Remove → `403`
- [ ] Remove while `ACTIVE` / `VACATION` → `409`
- [ ] Last Admin Remove → `409`
- [ ] Two ADMINs: A Removes INACTIVE B → `200`; A still a non-`REMOVED` ADMIN
- [ ] Body `actorId` ignored (adapter overwrite)
- [ ] Original email is free for a later Create as a **new** id (email policy still blocks while `INACTIVE`)
- [ ] Use-case + controller specs pass

## Reference map

| Concern | Look at |
|---------|---------|
| Create command style | `application/usecases/create-employee.usecase.ts` |
| CompareHash | `@shared/application/ports/compare-hash.port.ts` + `BcryptAdapter` |
| Auth opacity | `AuthenticationError` message `Authentication failed` |
| Policy | `EmployeeLifecyclePolicy` |
| Persist method | `EmployeeMongooseRepository.anonymize` |
| Next slice | [`05-list-and-module-contract.md`](./05-list-and-module-contract.md) |
