# Spec: Slice 2 — `UpdateProfessionalEmployeeDataUsecase`

> Application command: Actor/Target, resolver, professional policy, lifecycle on a Status delta, patch service, one persist patch.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), [`01-persistence.md`](./01-persistence.md).  
> Design §8. [ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md).  
> Jira: TBD.  
> Next: [`03-http-and-contract.md`](./03-http-and-contract.md).

## Responsibility (this spec only)

Orchestrate Update Professional Employee Data behind an inbound port. The use case loads Actor and Target, drops `undefined` keys, computes Role / Status deltas, checks the professional policy, reuses `EmployeeLifecyclePolicy` **only** on a Status delta, asks the patch service to mutate Job Title / Role, applies lifecycle transitions on a delta, and persists **one** merged patch — or skips persist when the patch is empty (echoed Role and/or echoed Status, no Job Title).

It does not check occupancy. It does not call `updateStatus`. It does not throw already-in-status errors on an echoed Status. It does not turn blank `jobTitle` into `null` at HTTP (the controller does); the patch service still normalizes blank if it arrives.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Policy + patch service + `changeJobTitle` |
| [`01`](./01-persistence.md) | `updateProfessionalData` + `countLoginCapableAdmins` |
| **This file** | DTO + inbound port + resolver + mapper seam + use case + spec |
| [`03`](./03-http-and-contract.md) | Controller / route / `AGENT.md` |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `UpdateProfessionalEmployeeDataDto` + result DTO | Yes |
| Inbound `UpdateProfessionalEmployeeDataPort` | Yes |
| `resolveProfessionalEmployeeDataChanges` | Yes |
| `UpdateProfessionalEmployeeDataUsecase` + spec | Yes |
| `EmployeeSnapshotMapper.toEntity` forwards `jobTitle` | Yes |
| Controller / route / module HTTP wiring | **No** |
| `AGENT.md` living contract | **No** — slice 3 |
| Encrypter / occupancy / Main / Personal policies | **No** |
| New lifecycle intent / Actor widening | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Update Professional Employee Data following [`docs/specs/update-professional-employee-data/02-usecase.md`](./02-usecase.md).  
> Load Actor and Target, `resolveProfessionalEmployeeDataChanges`, compute `roleChange` / `statusChange`, call `EmployeeProfessionalDataPolicy.assertCan`, then `EmployeeLifecyclePolicy` on a Status delta only, then the patch service, then entity transitions on a Status delta, then one persist patch.  
> Reconstitute with snapshot `jobTitle`. Skip persist when only echoed Role/Status. Do not throw already-in-status on an echoed Status. Never `Employee.create`. Do not call `updateStatus`. Do not add the controller or route.

## Application contracts

### DTO — `application/dtos/update-professional-employee-data.dto.ts`

```ts
interface UpdateProfessionalEmployeeDataDto {
  actorId: string                   // adaptRoute; never from the client body
  id: string                        // path :id
  jobTitle?: string | null          // present + null/blank → clear (controller normalizes)
  role?: string                     // present; never null (controller already refused)
  status?: string                   // present; never null; never REMOVED (controller already refused)
}

interface UpdateProfessionalEmployeeDataResultDto {
  id: string
}
```

Inbound DTO only contains keys the controller decided were present. `null` is present on `jobTitle`. A class with a constructor is fine if it matches the existing `UpdatePersonalEmployeeDataDto` style. Do not trim `jobTitle` inside the DTO.

### Inbound port — `application/ports/inbound/update-professional-employee-data.port.ts`

```ts
interface UpdateProfessionalEmployeeDataPort {
  execute(
    params: UpdateProfessionalEmployeeDataDto,
  ): Promise<UpdateProfessionalEmployeeDataResultDto>
}
```

### Resolver — `application/services/professional-employee-data-changes.resolver.ts`

Mirror `resolvePersonalEmployeeDataChanges`. The domain `ProfessionalEmployeeDataChanges` type is Job Title + Role only. The resolver **also** carries `status` because Status may travel on this command.

```ts
type ProfessionalEmployeeDataInput = {
  jobTitle?: string | null | undefined
  role?: string | undefined
  status?: string | undefined
}

type ResolvedProfessionalEmployeeDataChanges = {
  jobTitle?: string | null
  role?: string
  status?: string
}

function resolveProfessionalEmployeeDataChanges(
  fields: ProfessionalEmployeeDataInput,
): ResolvedProfessionalEmployeeDataChanges
```

Strip entries whose value is `undefined`. If none of `jobTitle` / `role` / `status` survive, throw `EmptyProfessionalEmployeeDataError`. Do not treat `null` as absent (`jobTitle: null` is a clear). Do not validate Role / Status enums here.

## Use case flow (normative)

Constructor:

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  professionalDataPolicy: EmployeeProfessionalDataPolicy,
  professionalDataPatchService: EmployeeProfessionalDataPatchService,
  lifecyclePolicy: EmployeeLifecyclePolicy,
  updateProfessionalDataRepository: UpdateProfessionalEmployeeDataRepositoryPort,
)
```

Same repository instance will implement `findById` + `updateProfessionalData` in the module (slice 3). The same `EmployeeLifecyclePolicy` instance already used by Update Status / Remove is injected — do not construct a second one in this slice (there is no module file here). The patch service has no ports.

Do not inject `EmployeeMainDataPolicy`, `EmployeePersonalDataPolicy`, encrypter, or occupancy.

```text
execute({ actorId, id, jobTitle?, role?, status? })
  1. actorId empty/blank → ActorAuthenticationFailedError
  2. findById(actorId) — miss → same 401 error
  3. findById(id) — miss → EmployeeNotFoundError
  4. EmployeeSnapshotMapper.toEntity on Actor and Target
       Password.fromHash
       jobTitle from the snapshot (see mapper seam)
       never Employee.create
  5. resolveProfessionalEmployeeDataChanges({ jobTitle, role, status })
       throws EmptyProfessionalEmployeeDataError when every command key is undefined
  6. If role is present and not EmployeeModel.isRole → InvalidEmployeeRoleError
     roleChange = role !== undefined && role !== target.role
  7. If status is present and not operational (including REMOVED)
       → InvalidEmployeeStatusError before any write
     statusChange = status !== undefined && status !== target.status
  8. professionalDataPolicy.assertCan({ actor, target, roleChange })
  9. If statusChange → mapIntent (ACTIVE→REACTIVATE, INACTIVE→DEACTIVATE, VACATION→VACATION)
       → lifecyclePolicy.assertCan({ actor, target, intent })
 10. professionalDataPatchService.apply(target, { jobTitle?, role? })
       pass role only after it is a Role; do not pass status
 11. If statusChange → activate / deactivate / putOnVacation on the Target
       same switch as UpdateEmployeeStatusUsecase.applyTransition
       copy the private helpers; do not extract a shared module; do not edit Update Status
 12. Merge persist patch:
       professional keys from step 10
       + { status, deactivateAt } from the entity only if statusChange
 13. If the merged patch has no keys besides id
       (only echoed role and/or echoed status, no jobTitle)
       → return { id } without calling the repository
 14. Else updateProfessionalData({ id, ...patch })
 15. Return { id }
```

If steps 1–11 throw, **do not** call `updateProfessionalData`.

Load Actor **before** Target. Actor miss is `ActorAuthenticationFailedError`, not `EmployeeNotFoundError`.

`findById` is called twice (two ids). Specs must assert both calls.

Evaluate **all** refusals that can be known before mutate+persist. Order above is the contract: professional policy (including Role Last Admin) before lifecycle, both before persist.

Copy `mapIntent` + `applyTransition` from `UpdateEmployeeStatusUsecase`. Do **not** call `updateEmployeeStatusRepository.updateStatus`. Do **not** persist `employee.toJSON()` (`Password.toJSON()` is `'[REDACTED]'`).

### Echo vs delta

| Present key | vs Target | Effect |
|-------------|-----------|--------|
| `jobTitle` (any value, including equal / `null`) | n/a | always on the persist patch after `apply` |
| `role` equal to `target.role` | echo | `roleChange: false`; omitted from persist patch |
| `role` different | delta | `roleChange: true`; policy Role rules; persist `role` |
| `status` equal to `target.status` | echo | `statusChange: false`; do **not** call lifecycle; do **not** call `activate` / `deactivate` / `putOnVacation`; no already-in-status error; no `status` / `deactivateAt` on the patch |
| `status` different | delta | `statusChange: true`; lifecycle `assertCan` + transition; persist `status` + `deactivateAt` |

Dedicated Update Status **keeps** already-in-status as `400`. This command must not throw `EmployeeAlreadyActiveError` / `EmployeeAlreadyInactiveError` / `EmployeeAlreadyOnVacationError` on an echo.

### Mapper seam — `jobTitle` on reconstitute

`EmployeeSnapshotMapper.toEntity` today rebuilds name, email, phone, nif, role, status, username, personal fields, and dates. It does **not** pass `jobTitle`, so `reconstitute` defaults it to `null`.

Extend `toEntity`:

| Snapshot field | Reconstitute |
|----------------|--------------|
| `jobTitle` | `snapshot.jobTitle ?? null` |

Do not add `employmentId` in this slice unless the mapper already requires it for typing — this command never writes it.

Other commands use this mapper and persist their own patches, not `toJSON()`. Forwarding `jobTitle` must not change `updateMainData` / `updatePersonalData` / lifecycle writes.

## Files

| File | Action |
|------|--------|
| `application/dtos/update-professional-employee-data.dto.ts` | Create |
| `application/ports/inbound/update-professional-employee-data.port.ts` | Create |
| `application/services/professional-employee-data-changes.resolver.ts` | Create |
| `application/usecases/update-professional-employee-data.usecase.ts` + `*.spec.ts` | Create |
| `application/mappers/employee-snapshot.mapper.ts` | Forward `jobTitle` |
| Controller / routes / `employees.module.ts` / `AGENT.md` / `.http` | Do not change |

## Spec expectations (`update-professional-employee-data.usecase.spec.ts`)

`makeStubs` / `makeSut` / `SutTypes`. Stub `FindEmployeeByIdPort`, `EmployeeProfessionalDataPolicy` (`assertCan: jest.fn().mockResolvedValue(undefined)`), `EmployeeLifecyclePolicy` (`assertCan: jest.fn().mockResolvedValue(undefined)`), and `UpdateProfessionalEmployeeDataRepositoryPort`. Use a real `EmployeeProfessionalDataPatchService` (no ports) so Role / Job Title failures are the domain ones — or stub `apply` only for cases that assert policy-error propagation. Default snapshots: Actor ADMIN ACTIVE (different id), Target EMPLOYEE ACTIVE with `jobTitle: 'old'`, `role: EMPLOYEE`, `status: ACTIVE` so a one-field persist can prove the other keys were not sent.

`findById` must dispatch by id (Actor vs Target). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdateProfessionalEmployeeDataUsecase` |
| missing / blank `actorId` | `ActorAuthenticationFailedError`; no Target `findById`; no persist |
| Actor `findById` null | `ActorAuthenticationFailedError`; no persist |
| Target `findById` null | `EmployeeNotFoundError`; no persist |
| `should call findById with actorId then target id` | both ids |
| no professional/status keys (`undefined` only) | `EmptyProfessionalEmployeeDataError`; no persist; policy not called |
| `{ role: 'ROOT' }` | `InvalidEmployeeRoleError`; policy not called; no persist |
| `{ status: 'REMOVED' }` / `{ status: 'nope' }` | `InvalidEmployeeStatusError`; no persist |
| `assertCan` (professional) called with `roleChange: false` on Job Title only | before persist |
| professional `assertCan` throws forbidden / actor-auth / already-removed / Last Admin | propagate; lifecycle not called; `apply` not called; no persist |
| `{ jobTitle: 'Barbeiro' }` only | persist `{ id, jobTitle: 'Barbeiro' }`; no `role` / `status`; lifecycle not called |
| `{ jobTitle: null }` | persist `{ id, jobTitle: null }` |
| `{ jobTitle }` equal to snapshot `'old'` | persist `{ id, jobTitle: 'old' }` (always, when present) |
| `{ role: 'EMPLOYEE' }` on EMPLOYEE Target (echo) | return `{ id }`; **no persist**; lifecycle not called; professional `roleChange: false` |
| `{ role: 'MANAGER' }` on EMPLOYEE Target | professional `roleChange: true`; persist `{ id, role: 'MANAGER' }`; counts are the policy’s job (stub) |
| `{ status: 'ACTIVE' }` on ACTIVE Target (echo) | return `{ id }`; **no persist**; lifecycle **not** called; no already-in-status error |
| `{ status: 'INACTIVE' }` on ACTIVE Target | lifecycle `assertCan` with `DEACTIVATE`; persist `{ id, status: INACTIVE, deactivateAt: Date }` |
| `{ status: 'ACTIVE' }` on INACTIVE Target | lifecycle `REACTIVATE`; persist `status: ACTIVE` and `deactivateAt: null` |
| `{ status: 'VACATION' }` on ACTIVE Target | lifecycle `VACATION`; persist `status: VACATION` and `deactivateAt: null` |
| lifecycle `assertCan` throws forbidden / actor-auth / Last Admin | propagate; no persist |
| `{ jobTitle: 'Barbeiro', role: 'EMPLOYEE' }` echo Role | persist `{ id, jobTitle: 'Barbeiro' }` only |
| `{ jobTitle: 'Barbeiro', status: 'ACTIVE' }` echo Status | persist `{ id, jobTitle: 'Barbeiro' }` only; lifecycle not called |
| `{ role: 'EMPLOYEE', status: 'ACTIVE' }` both echo | no persist |
| `{ jobTitle, role: 'MANAGER', status: 'INACTIVE' }` all deltas | one persist call with `jobTitle`, `role`, `status`, `deactivateAt` |
| Role-delta refusal (professional throws) + Status also present | no persist (no partial write) |
| Status-delta refusal (lifecycle throws) + Job Title present | no persist |
| `Password.fromHash` on load | spy; `Password.create` not used |
| reconstituted Target keeps snapshot `jobTitle: 'old'` | a Role-echo persist-skip still proves mapper forwarded `jobTitle` (or a dedicated mapper case) |
| no Encrypter / occupancy / Main / Personal policy deps | constructor arity |
| does not call `updateStatus` | no such collaborator on the constructor |

If the mapper spec is separate, one case is enough: `toEntity` keeps `jobTitle` from the snapshot. A Job Title-only persist is the proof that reconstitution did not leak role / status into `$set` unless they changed.

## Checklist (agent)

- [ ] Actor from `actorId`; never from a body field inside the use case
- [ ] Reconstitute via the snapshot mapper with `jobTitle` from the snapshot
- [ ] Resolver throws `EmptyProfessionalEmployeeDataError` when no command key is present
- [ ] Invalid Role / non-operational Status abort before policy and persist
- [ ] `roleChange` / `statusChange` computed after enum checks
- [ ] Professional policy before lifecycle; both before mutate+persist
- [ ] Lifecycle + `activate` / `deactivate` / `putOnVacation` run only on `statusChange`
- [ ] Echoed Status does not throw already-in-status
- [ ] Echoed Role + echoed Status + no Job Title → `{ id }` and no repository call
- [ ] Present Job Title always reaches persist when the merged patch is written
- [ ] One `updateProfessionalData` call; never `updateStatus`; never `toJSON()` as the write
- [ ] Never `Employee.create`
- [ ] Co-located spec covers the table
- [ ] No controller / route / `AGENT.md` in this slice

## Out of scope

- HTTP presence, `password` key, blank `jobTitle`, null `role` / `status` (controller)
- `requireRoles`
- Self-service
- Get-by-id query
- JWT revoke after Role / Status change
- Changing `EmployeeLifecyclePolicy` Actor to login-capable

## Acceptance criteria

- [ ] `{ jobTitle: 'Barbeiro' }` → persist `{ jobTitle: 'Barbeiro' }`; role and status not in the payload
- [ ] `{ jobTitle: null }` → persist `{ jobTitle: null }`
- [ ] `{ role: 'MANAGER' }` on EMPLOYEE → persist `{ role: 'MANAGER' }`; professional `roleChange: true`
- [ ] Last Admin leaving `ADMIN` (policy throws `LastAdminProtectedError`) → no persist
- [ ] `{ role }` equal to Target → `{ id }`; no persist
- [ ] `{ status: 'INACTIVE' }` on ACTIVE → lifecycle + persist `status` / `deactivateAt`
- [ ] `{ status: 'ACTIVE' }` on already ACTIVE → `{ id }`; no already-in-status; no persist unless Job Title also present
- [ ] `{ status: 'REMOVED' }` → `InvalidEmployeeStatusError`; no persist
- [ ] Target `INACTIVE` + Job Title only → persist Job Title; lifecycle not called (not Reactivate)
- [ ] Role-delta refusal or lifecycle refusal → no persist
- [ ] No command keys → `EmptyProfessionalEmployeeDataError`; no persist
- [ ] Blank `actorId` / Actor miss → `ActorAuthenticationFailedError` before Target load when possible
- [ ] Target miss → `EmployeeNotFoundError`
- [ ] Use-case spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Sibling command flow | `application/usecases/update-personal-employee-data.usecase.ts` |
| Status intent + transition to copy (do not edit) | `application/usecases/update-employee-status.usecase.ts` (`mapIntent`, `applyTransition`) |
| Resolver to mirror | `application/services/personal-employee-data-changes.resolver.ts` |
| Reconstitute seam | `application/mappers/employee-snapshot.mapper.ts` |
| Professional policy | `domain/services/employee-professional-data.policy.ts` |
| Patch service | `domain/services/employee-professional-data-patch.service.ts` |
| Lifecycle (reuse, do not change) | `domain/services/employee-lifecycle.policy.ts` |
| Persist port | `application/ports/outbound/update-professional-employee-data-repository.port.ts` |
| Why Status travels here | [ADR 0001](../../adr/update-professional-employee-data/0001-status-travels-with-professional-save.md) |
| Next slice | [`03-http-and-contract.md`](./03-http-and-contract.md) |
