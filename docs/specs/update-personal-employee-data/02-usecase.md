# Spec: Slice 2 — `UpdatePersonalEmployeeDataUsecase`

> Application command: Actor/Target, policy, resolver, patch service, persist patch.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md), [`01-persistence.md`](./01-persistence.md).  
> Design §8.  
> Jira: TBD.  
> Next: [`03-http-and-contract.md`](./03-http-and-contract.md).

## Responsibility (this spec only)

Orchestrate Update Personal Employee Data behind an inbound port. The use case loads Actor and Target, checks the policy, drops `undefined` keys, asks the patch service to validate and mutate, and persists the returned patch. It does not check occupancy. It does not coerce `nif` to `Number` (the repository does). It does not turn blank `languages` / `address` into `null` (the controller does).

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Policy + patch service + `assign*` |
| [`01`](./01-persistence.md) | `updatePersonalData` |
| **This file** | DTO + inbound port + resolver + use case + snapshot mapper seam + spec |
| [`03`](./03-http-and-contract.md) | Controller / route / `AGENT.md` |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `UpdatePersonalEmployeeDataDto` + result DTO | Yes |
| Inbound `UpdatePersonalEmployeeDataPort` | Yes |
| `resolvePersonalEmployeeDataChanges` | Yes |
| `UpdatePersonalEmployeeDataUsecase` + spec | Yes |
| `EmployeeSnapshotMapper.toEntity` forwards personal fields | Yes |
| Controller / route / module HTTP wiring | **No** |
| `AGENT.md` living contract | **No** — slice 3 |
| Encrypter / `CompareHashPort` / occupancy / lifecycle policy / main-data policy | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Update Personal Employee Data following [`docs/specs/update-personal-employee-data/02-usecase.md`](./02-usecase.md).  
> Load Actor and Target, call `EmployeePersonalDataPolicy.assertCan`, `resolvePersonalEmployeeDataChanges`, then synchronous `EmployeePersonalDataPatchService.apply`, and persist the patch.  
> Reconstitute with all personal fields from the snapshot. No occupancy check. Never `Employee.create`. Do not add the controller or route.

## Application contracts

### DTO — `application/dtos/update-personal-employee-data.dto.ts`

```ts
interface UpdatePersonalEmployeeDataDto {
  actorId: string                   // adaptRoute; never from the client body
  id: string                        // path :id
  gender?: string | null            // present + null → clear; '' is not a clear
  languages?: string | null         // controller already normalized blank → null
  emergencyContact?: string | null
  nif?: string | null               // controller already coerced number → string
  address?: string | null           // controller already normalized blank → null
}

interface UpdatePersonalEmployeeDataResultDto {
  id: string
}
```

Inbound DTO only contains keys the controller decided were present. `null` is present. The repository `$set`s exactly the keys on the **patch** the domain service returns (normalized), not a second copy of the raw DTO.

A class with a constructor is fine if it matches the existing `UpdateMainEmployeeDataDto` style. Do not trim `languages` / `address` / `gender` inside the DTO. Do not `Number()` the `nif`.

### Inbound port — `application/ports/inbound/update-personal-employee-data.port.ts`

```ts
interface UpdatePersonalEmployeeDataPort {
  execute(
    params: UpdatePersonalEmployeeDataDto,
  ): Promise<UpdatePersonalEmployeeDataResultDto>
}
```

### Resolver — `application/services/personal-employee-data-changes.resolver.ts`

Mirror `resolveMainEmployeeDataChanges`.

```ts
function resolvePersonalEmployeeDataChanges(
  fields: PersonalEmployeeDataInput,
): PersonalEmployeeDataChanges
```

`PersonalEmployeeDataInput` is `Partial<Record<PersonalEmployeeDataField, string | null | undefined>>`. Strip entries whose value is `undefined`. If no key survives, throw `EmptyPersonalEmployeeDataError`. Do not treat `null` as absent. Do not validate gender, phone, or NIF here.

## Use case flow (normative)

Constructor:

```ts
constructor(
  findEmployeeById: FindEmployeeByIdPort,
  personalDataPolicy: EmployeePersonalDataPolicy,
  personalDataPatchService: EmployeePersonalDataPatchService,
  updatePersonalDataRepository: UpdatePersonalEmployeeDataRepositoryPort,
)
```

Same repository instance will implement `findById` + `updatePersonalData` in the module (slice 3). Inject the ports and the two domain services. Do not construct adapters. The patch service has no ports — `new EmployeePersonalDataPatchService()` is the module's job, not this slice's wiring file, but the use case receives the instance.

```text
execute({ actorId, id, gender?, languages?, emergencyContact?, nif?, address? })
  1. actorId empty/blank → ActorAuthenticationFailedError
  2. findById(actorId) — miss → same 401 error
  3. findById(id) — miss → EmployeeNotFoundError
  4. EmployeeSnapshotMapper.toEntity on Actor and Target
       which calls Employee.reconstitute
       Password.fromHash
       personal fields from the snapshot (see mapper seam)
       never Employee.create
  5. personalDataPolicy.assertCan({ actor, target })
  6. resolvePersonalEmployeeDataChanges({ gender, languages, emergencyContact, nif, address })
       throws EmptyPersonalEmployeeDataError when every personal key is undefined
  7. personalDataPatchService.apply(target, changes)   // sync; do not mark the call as I/O
  8. updatePersonalData({ id, ...patch })
       the patch already omitted absent keys and normalized VO values
       nif on this object is still a string or null
  9. return { id }
```

If steps 1–7 throw, **do not** call `updatePersonalData`.

Load Actor **before** Target. Actor miss is `ActorAuthenticationFailedError`, not `EmployeeNotFoundError`.

`findById` is called twice (two ids). Specs must assert both calls.

### Mapper seam — personal fields on reconstitute

`EmployeeSnapshotMapper.toEntity` today rebuilds name, email, phone, nif, role, status, username, and dates. It does **not** pass `gender`, `address`, `languages`, or `emergencyContact`, so `reconstitute` defaults them to `null`.

Extend `toEntity` so the in-memory employee matches the snapshot:

| Snapshot field | Reconstitute |
|----------------|--------------|
| `gender` | `snapshot.gender ?? null` (string as stored; do not `isGender` on load) |
| `address` | `snapshot.address ?? null` |
| `languages` | `snapshot.languages ?? null` |
| `emergencyContact` | non-null → `Phone.create(snapshot.emergencyContact)`; otherwise `null` |
| `nif` | already `Nif.create` when present — leave that |

Do not validate gender while loading. A legacy string that is not in the enum must still reconstitute; this command rejects a bad gender only when the key is on the patch.

Other commands use this mapper and persist their own patches, not `toJSON()`. Forwarding the extra fields must not change `updateMainData` / lifecycle writes. Do not persist `employee.toJSON()` (`Password.toJSON()` is `'[REDACTED]'`).

## Files

| File | Action |
|------|--------|
| `application/dtos/update-personal-employee-data.dto.ts` | Create |
| `application/ports/inbound/update-personal-employee-data.port.ts` | Create |
| `application/services/personal-employee-data-changes.resolver.ts` | Create |
| `application/usecases/update-personal-employee-data.usecase.ts` + `*.spec.ts` | Create |
| `application/mappers/employee-snapshot.mapper.ts` | Forward the four personal fields |
| Controller / routes / `employees.module.ts` / `AGENT.md` / `.http` | Do not change |

## Spec expectations (`update-personal-employee-data.usecase.spec.ts`)

`makeStubs` / `makeSut` / `SutTypes`. Stub `FindEmployeeByIdPort`, `EmployeePersonalDataPolicy` (`assertCan: jest.fn()`), and `UpdatePersonalEmployeeDataRepositoryPort`. Use a real `EmployeePersonalDataPatchService` (no ports) so gender / phone / NIF failures are the domain ones — or stub `apply` only for the cases that assert propagation of policy errors. Default snapshots: Actor ADMIN ACTIVE (different id), Target EMPLOYEE ACTIVE with personal fields filled (for example `gender: 'female'`, `languages: 'en'`, `address: 'old'`, `nif: '123456789'`, `emergencyContact` a valid stored phone) so a one-field persist can prove the other keys were not sent.

`findById` must dispatch by id (Actor vs Target). `afterEach` → `jest.restoreAllMocks()`. No Mongo / HTTP.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance of `UpdatePersonalEmployeeDataUsecase` |
| missing / blank `actorId` | `ActorAuthenticationFailedError`; no Target `findById`; no persist |
| Actor `findById` null | `ActorAuthenticationFailedError`; no persist |
| Target `findById` null | `EmployeeNotFoundError`; no persist |
| `should call findById with actorId then target id` | both ids |
| `assertCan` called before persist | with the reconstituted actor and target |
| `assertCan` throws forbidden / actor-auth / already-removed | propagate; `apply` not called; no persist |
| `{ gender: 'male' }` only | persist `{ id, gender: 'male' }`; no other personal keys |
| `{ gender: null }` | persist `{ id, gender: null }` |
| `{ gender: 'invalid' }` / `{ gender: '' }` | `InvalidEmployeeGenderError`; no persist |
| `{ nif: null }` | persist `{ id, nif: null }` |
| `{ nif: '123456789' }` | persist `{ id, nif: '123456789' }` (string) |
| `{ nif: '00000000' }` | `InvalidNifError`; no persist |
| `{ emergencyContact: null }` | persist `{ id, emergencyContact: null }` |
| valid `emergencyContact` | persist the **normalized** `Phone` value |
| `{ emergencyContact: '123' }` | `InvalidPhoneFormatError`; no persist |
| `{ languages: 'Português' }` | persist that string |
| `{ languages: null }` | persist `{ id, languages: null }` |
| `{ address: 'Rua X' }` | persist `{ id, address: 'Rua X' }` |
| all five keys | persist all five; `nif` still a string |
| no personal keys (`undefined` only) | `EmptyPersonalEmployeeDataError`; no persist |
| `Password.fromHash` on load | spy; `Password.create` not used |
| gender-only persist does not send the snapshot's other personal fields | payload has no `address` / `languages` / `nif` / `emergencyContact` |
| no Encrypter / CompareHash / occupancy / lifecycle / main-data policy deps | constructor arity |

If the mapper spec is separate, one case is enough: `toEntity` keeps `gender`, `languages`, `address`, and builds `emergencyContact` through `Phone.create`. A gender-only use-case persist is the proof that reconstitution did not leak the other fields into `$set`.

## Checklist (agent)

- [ ] Actor from `actorId`; never from a body field inside the use case
- [ ] Reconstitute via the snapshot mapper with personal fields from the snapshot
- [ ] Policy before resolver, patch, and persist
- [ ] Resolver throws `EmptyPersonalEmployeeDataError` when no personal key is present
- [ ] `apply` stays synchronous at the call site
- [ ] Persist payload is the patch (present normalized keys only)
- [ ] `nif` handed to the repository is a string or `null`
- [ ] Never `Employee.create`; never `toJSON()` as the write
- [ ] No occupancy call
- [ ] Co-located spec covers the table
- [ ] No controller / route / `AGENT.md` in this slice

## Out of scope

- HTTP presence, `nif` number → string, blank `languages` / `address` (controller)
- `requireRoles`
- Self-service
- Get-by-id query

## Acceptance criteria

- [ ] `{ gender: 'male' }` → persist `{ gender: 'male' }`; other personal fields not in the payload
- [ ] `{ nif: null }` → persist `{ nif: null }`
- [ ] `{ nif: '123456789' }` → persist the string, not a number
- [ ] `{ gender: 'invalid' }` → `InvalidEmployeeGenderError`; no persist
- [ ] `{ emergencyContact: '123' }` → `InvalidPhoneFormatError`; no persist
- [ ] `{ nif: '00000000' }` → `InvalidNifError`; no persist
- [ ] No personal keys → `EmptyPersonalEmployeeDataError`; no persist
- [ ] Blank `actorId` / Actor miss → `ActorAuthenticationFailedError` before Target load when possible
- [ ] Target miss → `EmployeeNotFoundError`
- [ ] Policy refusal → no persist
- [ ] Use-case spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Sibling command flow | `application/usecases/update-main-employee-data.usecase.ts` |
| Resolver to mirror | `application/services/main-employee-data-changes.resolver.ts` |
| Reconstitute seam | `application/mappers/employee-snapshot.mapper.ts` |
| Policy | `domain/services/employee-personal-data.policy.ts` |
| Patch service | `domain/services/employee-personal-data-patch.service.ts` |
| Persist port | `application/ports/outbound/update-personal-employee-data-repository.port.ts` |
| Next slice | [`03-http-and-contract.md`](./03-http-and-contract.md) |
