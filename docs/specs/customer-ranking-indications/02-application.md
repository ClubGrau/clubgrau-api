# Spec: Slice 2 — Create customer application

> The use case validates the indication before it writes.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md) and [`01-persistence.md`](./01-persistence.md) (`ExistsCustomerByIdPort`).  
> Design §8 / [ADR 0001](../../adr/customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md).  
> Next: [`03-http.md`](./03-http.md). The adapter that implements the new port is [`04-linkable-origins.md`](./04-linkable-origins.md).

## Responsibility (this spec only)

Extend create-customer so a valid indication is checked, and an invalid one never reaches `create`. The domain decides. This slice only loads plain facts and passes them in.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | `Customer.create`, `Indication.ensureOriginIsLinkable`, `ensureReferrerExists` |
| [`01`](./01-persistence.md) | `ExistsCustomerByIdPort`, and `11000` inside the repository |
| **This file** | DTO, `FindIndicationOriginPort`, use case |
| [`03`](./03-http.md) | Controller maps the errors this use case throws |
| [`04`](./04-linkable-origins.md) | `IndicationOriginLookupAdapter` implements `FindIndicationOriginPort` |

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `CreateCustomerIndicationDto` on the existing DTO file | Yes |
| `FindIndicationOriginPort` | Yes |
| `CreateCustomerUsecase` + spec | Yes |
| `create-customer.dto.spec.ts` updated for the new field | Yes |
| Controller, routes, `customer.http` | **No** |
| `customers.module.ts`, `app.ts` | **No** |
| A second `ExistsCustomerByIdPort` | **No** |
| Catching `11000` in the use case | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/02-application.md`](./02-application.md).  
> `CreateCustomerUsecase` builds the customer, checks the email, then either `findOrigin` + `ensureOriginIsLinkable` or `existsById` + `ensureReferrerExists`, then `create`.  
> Do not catch Mongo errors here. Do not edit the controller or the module factory.

## DTO

File: `application/dtos/create-customer.dto.ts`.

```ts
export interface CreateCustomerIndicationDto {
  categoryId: string
  originId?: string | null
  referrerCustomerId?: string | null
}

export interface CreateCustomerDto {
  name: string
  email: string
  phone?: string | null
  nif?: number | null
  indication?: CreateCustomerIndicationDto | null
}

export interface CreateCustomerResultDto {
  id: string
}
```

`CreateCustomerResultDto` stays `{ id }`. There is no `rank` on the input.

## Port

File: `application/ports/outbound/find-indication-origin.port.ts`.

```ts
import { IndicationOriginFacts } from '@modules/customers/domain/models/indication-origin-facts'

export interface FindIndicationOriginPort {
  findOrigin(id: string): Promise<IndicationOriginFacts | null>
}
```

One method. `customers` does not implement it. Slice 4 does, inside `indications`. This file is the only `customers` type that adapter may import, together with whatever the port’s signature needs. The adapter must not import `@modules/customers/domain`.

`ExistsCustomerByIdPort` already exists from slice 1. Inject it. Do not recreate it.

`CreateCustomerRepositoryPort` stays as it is.

## Use case

File: `application/usecases/create-customer.usecase.ts`.

Constructor, in this order (design §12):

```ts
constructor(
  private readonly customerPoliciesService: CustomerPoliciesService,
  private readonly findIndicationOrigin: FindIndicationOriginPort,
  private readonly existsCustomerById: ExistsCustomerByIdPort,
  private readonly createCustomerRepository: CreateCustomerRepositoryPort,
)
```

`execute`:

1. `const customer = Customer.create({ name, email, phone, nif, indication: params.indication ?? null })`. VO errors, the indication shape, and `rank = BRONZE` happen here. Then `const snapshot = customer.toJSON()`.
2. `await this.customerPoliciesService.ensureEmailIsAvailable(snapshot.email)`.
3. `const indication = customer.indication`.
   - `indication === null`: call neither port.
   - Otherwise read `const link = indication.toJSON()`. The union narrows on `link.categoryId`.
   - `link.categoryId === 'amigo'`: `const exists = await this.existsCustomerById.existsById(link.referrerCustomerId)`, then `indication.ensureReferrerExists(exists)`. Do not call `findOrigin`.
   - otherwise (origin shape): `const facts = await this.findIndicationOrigin.findOrigin(link.originId)`, then `indication.ensureOriginIsLinkable(facts)`. Do not call `existsById`.
4. `const { id } = await this.createCustomerRepository.create(snapshot)`.
5. Return `{ id }`.

Nothing is written before step 4. A throw from step 1, 2, or 3 means `create` was not called.

Do not catch errors from `create`. The repository turns `11000` into `CustomerAlreadyExistsError`. This use case propagates that error and any other repository error.

Do not read `params` for a `rank`. Do not import `@modules/indications`.

The email check stays before the origin or referrer check. A taken email does not consult `indications`.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/customers/application/dtos/create-customer.dto.ts` |
| Edit | `src/modules/customers/application/dtos/create-customer.dto.spec.ts` |
| Create | `src/modules/customers/application/ports/outbound/find-indication-origin.port.ts` |
| Edit | `src/modules/customers/application/usecases/create-customer.usecase.ts` |
| Edit | `src/modules/customers/application/usecases/create-customer.usecase.spec.ts` |

## Spec expectations

Update `makeSut` so the use case receives the two new stubs. `findOrigin` resolves `null` by default. `existsById` resolves `false` by default. `create` still resolves `{ id: 'valid_customer_id' }`.

Keep the existing cases for email policy, invalid name, invalid email, invalid phone, repository errors, and the returned id. Extend the “repository called with” assertion so the snapshot includes `rank: 'BRONZE'` and `indication: null` when no indication was sent.

- No indication (`undefined` or `null`): `create` is called once with `rank: 'BRONZE'` and `indication: null`. `findOrigin` and `existsById` are not called.
- Origin indication: `findOrigin` is called with the lowercased origin id. When facts are `{ id, categoryId: 'canal', active: true }` matching the indication, `create` is called with that indication snapshot and `rank: 'BRONZE'`. `existsById` is not called.
- Origin indication and `findOrigin` resolves `null`: rejects with `CustomerIndicationOriginNotFoundError`, and `create` is not called.
- Origin indication and facts `categoryId` differ: rejects with `CustomerIndicationOriginCategoryMismatchError`, and `create` is not called.
- Origin indication and `active: false` with the same category: rejects with `CustomerIndicationOriginEndedError`, and `create` is not called.
- Friend indication and `existsById` resolves `true`: `create` is called with the friend snapshot. `findOrigin` is not called. `existsById` receives the referrer id.
- Friend indication and `existsById` resolves `false`: rejects with `CustomerReferrerNotFoundError`, and `create` is not called.
- Incoherent indication (both ids, unknown category, missing id): rejects with `CustomerIndicationInvalidError` from `Customer.create`, and neither port nor `create` is called.
- Malformed origin id (`""` or a non-hex string) rejects with `InvalidUniqueEntityIdError`, and `create` is not called.
- `ensureEmailIsAvailable` rejects with `CustomerAlreadyExistsError`: neither port nor `create` is called.
- `Customer.create` is called with the dto fields and no `rank`.

`create-customer.dto.spec.ts`: one example that includes an `indication` object type-checks and keeps `categoryId`.

## Acceptance criteria

- [ ] A walk-in create writes `rank: 'BRONZE'` and `indication: null`, and does not call the origin or referrer ports.
- [ ] An origin create calls `findOrigin` and writes only when `ensureOriginIsLinkable` accepts the facts.
- [ ] A friend create calls `existsById` and writes only when the referrer exists.
- [ ] Any refusal happens before `create`.
- [ ] The use case does not import `indications` and does not catch `11000`.

## Out of scope

- The controller and its status codes.
- `customers.module.ts` and `app.ts`. The constructor change will not match the factory until slice 5.
- Implementing `FindIndicationOriginPort` (slice 4).

## Checklist

- [ ] DTO matches section DTO. Result stays `{ id }`.
- [ ] `FindIndicationOriginPort` has only `findOrigin`.
- [ ] Use case order is create → email → origin or referrer → repository `create`.
- [ ] A null indication skips both ports.
- [ ] An amigo indication never calls `findOrigin`. An origin indication never calls `existsById`.
- [ ] Existing name, email, phone, and “repository throws” cases still pass.
- [ ] No controller, route, or module file changed.
