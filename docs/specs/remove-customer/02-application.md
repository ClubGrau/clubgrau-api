# Spec: Slice 2 — Customers application

> The remove use case, and the two callers of the changed ports.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md) and [`01-persistence.md`](./01-persistence.md).  
> Design §8 / [ADR 0003](../../adr/remove-customer/0003-actor-password-is-verified-through-a-port-implemented-by-auth.md), [ADR 0004](../../adr/remove-customer/0004-removed-customer-leaves-the-base-but-stays-in-history.md).  
> Next: [`03-auth.md`](./03-auth.md) (implements `VerifyActorPasswordPort`) and [`04-http.md`](./04-http.md).

## Responsibility (this spec only)

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | `Customer.remove(now)`, the errors |
| [`01`](./01-persistence.md) | `FindCustomerByIdPort`, `RemoveCustomerRepositoryPort`, `ExistsReferrableCustomerByIdPort`, `ReferrerNameReadModel` |
| **This file** | `CustomerSnapshotMapper`, remove DTOs, `RemoveCustomerPort`, `VerifyActorPasswordPort`, `RemoveCustomerUsecase`; `CreateCustomerUsecase` and `GetCustomersQuery` on the changed ports |
| [`03`](./03-auth.md) | Implements `VerifyActorPasswordPort` |
| [`04`](./04-http.md) | Maps the errors this use case throws |

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `application/mappers/customer-snapshot.mapper.ts` + spec | Yes |
| `application/dtos/remove-customer.dto.ts` | Yes |
| `RemoveCustomerPort`, `VerifyActorPasswordPort` | Yes |
| `RemoveCustomerUsecase` + spec | Yes |
| `CreateCustomerUsecase` on `ExistsReferrableCustomerByIdPort` + spec | Yes |
| `GetCustomersQuery` with `referrerRemoved` + spec | Yes |
| Controller, routes, module, auth adapter | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Remove Customer following [`docs/specs/remove-customer/02-application.md`](./02-application.md).  
> `RemoveCustomerUsecase` verifies the actor password through `VerifyActorPasswordPort`, loads the customer, calls `remove(now)`, and persists with the guarded `remove`. Switch the create use case to the renamed port and add `referrerRemoved` to the list query. Do not edit controllers, routes, or the module factory.

## Snapshot mapper

File: `application/mappers/customer-snapshot.mapper.ts`. Mirrors `EmployeeSnapshotMapper`.

```ts
export class CustomerSnapshotMapper {
  static toEntity(snapshot: CustomerModel.toCreate): Customer {
    return Customer.reconstitute({
      id: snapshot.id,
      name: Name.create(snapshot.name),
      email: Email.create(snapshot.email),
      phone: snapshot.phone ? Phone.create(snapshot.phone) : null,
      nif: snapshot.nif ? Nif.create(snapshot.nif) : null,
      createdAt: snapshot.createdAt,
      rank: snapshot.rank,
      indication: snapshot.indication ? Indication.reconstitute(snapshot.indication) : null,
      removedAt: snapshot.removedAt ?? null,
    })
  }
}
```

## DTOs

File: `application/dtos/remove-customer.dto.ts`.

```ts
export interface RemoveCustomerDto {
  actorId: string
  customerId: string
  actorPassword: string
}

export interface RemoveCustomerResultDto {
  id: string
}
```

File: `application/dtos/get-customers.dto.ts` — the Friend shape gains `referrerRemoved`:

```ts
export type GetCustomersIndicationDto =
  | { categoryId: 'canal' | 'campanha'; originId: string; name: string | null }
  | { categoryId: 'amigo'; referrerCustomerId: string; name: string | null; referrerRemoved: boolean }
```

## Ports

```ts
// application/ports/inbound/remove-customer.port.ts
export interface RemoveCustomerPort {
  execute(params: RemoveCustomerDto): Promise<RemoveCustomerResultDto>
}

// application/ports/outbound/verify-actor-password.port.ts
/** Driven port: implemented by `auth`. Answers only whether the password matches a login-capable actor. */
export interface VerifyActorPasswordPort {
  verify(actorId: string, password: string): Promise<boolean>
}
```

`VerifyActorPasswordPort` is the only `customers` type the `auth` adapter may import. Its signature uses primitives only.

## `RemoveCustomerUsecase`

File: `application/usecases/remove-customer.usecase.ts`.

```ts
constructor(
  private readonly verifyActorPassword: VerifyActorPasswordPort,
  private readonly findCustomerById: FindCustomerByIdPort,
  private readonly removeCustomerRepository: RemoveCustomerRepositoryPort,
)
```

`execute`:

1. `params.actorId?.trim()` empty → throw `CustomerActorAuthenticationFailedError`.
2. `await this.verifyActorPassword.verify(params.actorId, params.actorPassword)`; `false` → throw `CustomerActorAuthenticationFailedError`. Do not catch errors from the port.
3. `const snapshot = await this.findCustomerById.findById(params.customerId)`; `null` → throw `CustomerNotFoundError`.
4. `const customer = CustomerSnapshotMapper.toEntity(snapshot)`; `customer.remove(new Date())`. A removed customer throws `CustomerAlreadyRemovedError` here.
5. `const removed = await this.removeCustomerRepository.remove(customer.toJSON())`; `false` → throw `CustomerAlreadyRemovedError`.
6. Return `{ id: customer.id }`.

The actor is checked before the target. With a wrong password, nothing about the customer is read.

## `CreateCustomerUsecase`

Replace the `ExistsCustomerByIdPort` dependency with `ExistsReferrableCustomerByIdPort` (same constructor position, field renamed `existsReferrableCustomerById`). The Friend branch calls `existsReferrableById(link.referrerCustomerId)`, then `indication.ensureReferrerExists(exists)`. Nothing else changes. A removed referrer is refused with `CustomerReferrerNotFoundError`.

## `GetCustomersQuery`

- The referrer names map becomes `Map<string, { name: string; removed: boolean }>`, built from `ReferrerNameReadModel`.
- `loadNames` for origins keeps `NameByIdReadModel`. Split the helper or type it generically; do not widen the origin port.
- Friend indication → `name: entry?.name ?? null`, `referrerRemoved: entry?.removed ?? false`.
- Canal and Campanha indications are unchanged and carry no `referrerRemoved`.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/customers/application/mappers/customer-snapshot.mapper.ts` |
| Create | `src/modules/customers/application/mappers/customer-snapshot.mapper.spec.ts` |
| Create | `src/modules/customers/application/dtos/remove-customer.dto.ts` |
| Edit | `src/modules/customers/application/dtos/get-customers.dto.ts` |
| Create | `src/modules/customers/application/ports/inbound/remove-customer.port.ts` |
| Create | `src/modules/customers/application/ports/outbound/verify-actor-password.port.ts` |
| Create | `src/modules/customers/application/usecases/remove-customer.usecase.ts` |
| Create | `src/modules/customers/application/usecases/remove-customer.usecase.spec.ts` |
| Edit | `src/modules/customers/application/usecases/create-customer.usecase.ts` |
| Edit | `src/modules/customers/application/usecases/create-customer.usecase.spec.ts` |
| Edit | `src/modules/customers/application/queries/get-customers.query.ts` |
| Edit | `src/modules/customers/application/queries/get-customers.query.spec.ts` |

## Spec expectations

`customer-snapshot.mapper.spec.ts`: a snapshot with phone, NIF, Friend indication, and `removedAt` round-trips to the same `toJSON()`. A snapshot without `removedAt` gives `null`.

`remove-customer.usecase.spec.ts` (`makeSut` with three stubs; `verify` resolves `true`, `findById` resolves a stored snapshot, `remove` resolves `true` by default):

- Happy path → returns `{ id }`; `remove` is called once with a snapshot that keeps `id`, `name`, `rank`, `indication`, `createdAt`, has the sentinel email, `phone: null`, `nif: null`, and a `removedAt` date.
- `verify` is called with `actorId` and `actorPassword`.
- Blank or missing `actorId` → `CustomerActorAuthenticationFailedError`; `verify`, `findById`, `remove` are not called.
- `verify` resolves `false` → `CustomerActorAuthenticationFailedError`; `findById` and `remove` are not called.
- `verify` rejects → the same error propagates.
- `findById` resolves `null` → `CustomerNotFoundError`; `remove` is not called.
- `findById` resolves a snapshot with `removedAt` set → `CustomerAlreadyRemovedError`; `remove` is not called.
- `remove` resolves `false` → `CustomerAlreadyRemovedError`.
- `remove` rejects → the error propagates.

`create-customer.usecase.spec.ts`: rename the `existsById` stub to `existsReferrableById`. Existing Friend cases keep their meaning: `false` → `CustomerReferrerNotFoundError`.

`get-customers.query.spec.ts`:

- Friend indication whose referrer row has `removed: true` → `name` is the referrer name, `referrerRemoved: true`.
- Friend indication with `removed: false` → `referrerRemoved: false`.
- Friend indication whose id has no row → `name: null`, `referrerRemoved: false`.
- Canal and Campanha items have no `referrerRemoved` key.

## Acceptance criteria

- [ ] The remove use case verifies the password before reading the customer.
- [ ] Every refusal happens before the repository `remove`, except the lost race, which is reported as already removed.
- [ ] The create use case refuses a removed referrer as not found.
- [ ] The listing flags removed referrers and leaves other indications unchanged.
- [ ] No file imports `@modules/auth`, `@modules/employees`, or `@modules/indications`.

## Out of scope

- The adapter that implements `VerifyActorPasswordPort` (slice 3).
- Controller and status codes (slice 4).
- `customers.module.ts` (slice 5).

## Checklist

- [ ] Mapper mirrors `EmployeeSnapshotMapper` and handles `removedAt`.
- [ ] `VerifyActorPasswordPort` has only `verify`, with primitive arguments.
- [ ] Use case order is actor → password → load → `remove(now)` → persist.
- [ ] Create use case depends on `ExistsReferrableCustomerByIdPort`.
- [ ] Query adds `referrerRemoved` on Friend indications only.
