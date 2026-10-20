# Spec: Slice 0 — Customers domain (rank, indication, customer)

> Pure domain for rank and indication on the customer.  
> Parent: [`README.md`](./README.md).  
> Depends on: none. Shared `Name`, `Email`, `Phone`, `Nif`, `UniqueEntityId`, and `DomainError` already exist.  
> Design §7 / [ADR 0002](../../adr/customer-ranking-indications/0002-indication-is-an-embedded-value-object-owned-by-customers.md) / [ADR 0004](../../adr/customer-ranking-indications/0004-rank-is-stored-and-born-bronze.md).  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

Give `Customer` a rank and an optional indication, and the errors later slices map to HTTP. Nothing is stored. Nothing is called over HTTP.

| Spec | Responsibility |
|------|----------------|
| **This file** | `Rank`, `Indication`, `IndicationOriginFacts`, `Customer` changes, new errors, specs |
| [`01`](./01-persistence.md) | Mongo stores `rank` and the embedded indication |
| [`02`](./02-application.md) | The use case loads facts and calls `ensureOriginIsLinkable` / `ensureReferrerExists` |
| [`03`](./03-http.md) | The controller maps these errors |

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `domain/rank.ts` | Yes |
| `domain/value-objects/indication.vo.ts` | Yes |
| `domain/models/indication-origin-facts.ts` | Yes |
| `Customer` (`rank`, optional `indication`, no `rank` on `create`) | Yes |
| New errors in `domain/errors/customer.errors.ts` | Yes |
| Co-located specs, including updates to `customer.spec.ts` and `customer.model.spec.ts` | Yes |
| Schema, repository, use case, controller, ports, `customers.module.ts` | **No** |
| An import of `@modules/indications` | **No** |
| A method that changes the rank | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/00-domain.md`](./00-domain.md).  
> Add `Rank`, `Indication`, and the new customer errors. `Customer.create` is born `BRONZE` and takes an optional indication. `Customer.create` takes no `rank`.  
> Do not add Mongo, ports, a use case, or an HTTP change. Do not import `@modules/indications`.

## 1. `Rank`

File: `domain/rank.ts` + co-located `rank.spec.ts`.

A closed set, same idea as `IndicationCategories`. Not an entity. Not a document.

```ts
export const RANKS = ['BRONZE', 'SILVER', 'GOLD'] as const
export type Rank = (typeof RANKS)[number]
export const INITIAL_RANK: Rank = 'BRONZE'
```

The array order is the ladder, lowest first. There is no `promote`, no `demote`, and no function that returns the next rank.

## 2. Facts

File: `domain/models/indication-origin-facts.ts`. No spec of its own; `indication.vo.spec.ts` covers the consumers.

```ts
export type IndicationOriginFacts = {
  id: string
  categoryId: string
  active: boolean
}
```

`categoryId` is a `string`, not the three-code union, so a wrong category is a comparison and not a type error. [ADR 0001](../../adr/customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md) includes `id` in the facts. `ensureOriginIsLinkable` does not branch on `id`.

Do not import this type from `indications`. The three category codes below are written again in this module on purpose ([ADR 0002](../../adr/customer-ranking-indications/0002-indication-is-an-embedded-value-object-owned-by-customers.md)).

## 3. `Indication`

File: `domain/value-objects/indication.vo.ts` + co-located `indication.vo.spec.ts`.

Extends shared `ValueObject`. Two shapes, as a discriminated union. An incoherent combination cannot be built.

```ts
export type IndicationSnapshot =
  | { categoryId: 'canal' | 'campanha'; originId: string }
  | { categoryId: 'amigo'; referrerCustomerId: string }
```

`toJSON()` returns that snapshot and nothing else. The origin shape has no `referrerCustomerId` key. The friend shape has no `originId` key.

```ts
static create(input: {
  categoryId: string
  originId?: string | null
  referrerCustomerId?: string | null
}): Indication

static reconstitute(snapshot: IndicationSnapshot): Indication

ensureOriginIsLinkable(facts: IndicationOriginFacts | null): void
ensureReferrerExists(exists: boolean): void
```

Getter: `categoryId`. The ids are read from `toJSON()`. That return is the discriminated union, so slice 2 switches on `categoryId === 'amigo'` and then reads `referrerCustomerId` or `originId` without a cast. Do not add a getter that returns the other shape's id as a string.

### Absent

A value is absent when it is `undefined` or `null`. Any other value, including `""`, a number, or an object, counts as sent.

### `create`

Run in this order. Stop at the first failure.

1. `categoryId` is exactly `'canal'`, `'campanha'`, or `'amigo'`. Anything else, including `''`, `'CANAL'`, or a non-string, throws `CustomerIndicationInvalidError`.
2. For `'canal'` or `'campanha'`: `originId` is required, and `referrerCustomerId` must be absent. A missing `originId`, or a present `referrerCustomerId` (including `""`), throws `CustomerIndicationInvalidError`.
3. For `'amigo'`: `referrerCustomerId` is required, and `originId` must be absent. Same error.
4. The required id must be a `string`. A non-string throws `CustomerIndicationInvalidError`. A string is passed to `new UniqueEntityId(id)`. A malformed id throws `InvalidUniqueEntityIdError` (shared). A 24-character hex string is accepted; `UniqueEntityId` lowercases it, so the stored id is lowercase.

Shape is checked before the hex check. `referrerCustomerId: ""` under `canal` is `CustomerIndicationInvalidError`, not `InvalidUniqueEntityIdError`. `originId: ""` under `canal` reaches step 4 and is `InvalidUniqueEntityIdError`.

`create` does not consult a catalog and does not check that the referrer exists. Those are `ensureOriginIsLinkable` and `ensureReferrerExists`, called later with data the use case loaded.

### `reconstitute`

Rebuilds a stored snapshot. Does not call `create`. Does not check the catalog, `active`, or that the referrer exists. The snapshot type is already one of the two shapes.

### `ensureOriginIsLinkable`

On a friend shape, throw a plain `Error` (`Indication.ensureOriginIsLinkable called on a friend indication`). That is a programming error. The use case never does this.

On an origin shape, in this order:

| Condition | Error |
|-----------|-------|
| `facts === null` | `CustomerIndicationOriginNotFoundError` |
| `facts.categoryId !==` this indication's `categoryId` | `CustomerIndicationOriginCategoryMismatchError` |
| `facts.active === false` | `CustomerIndicationOriginEndedError` |

A wrong category that is also ended is a category mismatch. Do not inspect `facts.id`.

### `ensureReferrerExists`

On an origin shape, throw a plain `Error` (`Indication.ensureReferrerExists called on an origin indication`).

On a friend shape, `exists === false` throws `CustomerReferrerNotFoundError`. `exists === true` returns.

## 4. Errors

Add these to `domain/errors/customer.errors.ts`. Each extends `DomainError` and takes no constructor argument. Keep `CustomerAlreadyExistsError` and its message `'Customer already exists'`.

| Error | Message |
|-------|---------|
| `CustomerIndicationInvalidError` | `Customer indication is invalid` |
| `CustomerIndicationOriginNotFoundError` | `Customer indication origin was not found` |
| `CustomerIndicationOriginCategoryMismatchError` | `Customer indication origin belongs to another category` |
| `CustomerIndicationOriginEndedError` | `Customer indication origin is ended` |
| `CustomerReferrerNotFoundError` | `Referrer customer was not found` |

Do not reuse `IndicationOriginNotFoundError` from `indications`.

## 5. `Customer`

File: `domain/entities/Customer.ts`. Update `customer.spec.ts` and `domain/models/customer.model.spec.ts`.

`CustomerModel.toCreate` stays `ReturnType<Customer['toJSON']>`. It gains `rank` and `indication` because `toJSON()` does. Do not hand-write a second snapshot type.

```ts
static create(input: {
  name: string
  email: string
  phone?: string | null
  nif?: number | null
  indication?: {
    categoryId: string
    originId?: string | null
    referrerCustomerId?: string | null
  } | null
}): Customer

static reconstitute(input: {
  id: string
  name: Name
  email: Email
  phone: Phone | null
  nif: Nif | null
  createdAt: Date
  rank: Rank
  indication: Indication | null
}): Customer
```

`create` takes no `rank`. It sets `rank` to `INITIAL_RANK`. `indication` `null` or `undefined` is stored as `null`. Any other value is `Indication.create(...)`, so a bad indication throws before the customer exists.

`reconstitute` takes the rank it was given, including `'SILVER'` and `'GOLD'`, so a later PRD can add the transition without reshaping the entity. It does not force Bronze. A snapshot indication is `Indication.reconstitute(...)`. `null` stays `null`.

Getters used by slice 2: `rank`, `indication` (`Indication | null`).

`toJSON()` serializes `indication` through the value object (`Entity.toJSON` already calls `ValueObject.toJSON`). `null` stays `null`. `rank` is the string.

Leave the existing phone and nif rules as they are: a falsy `phone` or `nif` is `null`; a present value goes through `Phone.create` / `Nif.create`. Leave `changeName`, `changeEmail`, `assignPhone`, and `assignNif`. Do not add `changeRank` or `assignIndication`.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/customers/domain/rank.ts` |
| Create | `src/modules/customers/domain/rank.spec.ts` |
| Create | `src/modules/customers/domain/value-objects/indication.vo.ts` |
| Create | `src/modules/customers/domain/value-objects/indication.vo.spec.ts` |
| Create | `src/modules/customers/domain/models/indication-origin-facts.ts` |
| Edit | `src/modules/customers/domain/errors/customer.errors.ts` |
| Edit | `src/modules/customers/domain/entities/Customer.ts` |
| Edit | `src/modules/customers/domain/entities/customer.spec.ts` |
| Edit | `src/modules/customers/domain/models/customer.model.spec.ts` |

## Spec expectations

`rank.spec.ts`

- `RANKS` is `['BRONZE', 'SILVER', 'GOLD']` in that order.
- `INITIAL_RANK` is `'BRONZE'`.

`indication.vo.spec.ts`

- `canal` + a 24-hex `originId` builds, and `toJSON()` is `{ categoryId: 'canal', originId }` with the id lowercased. No `referrerCustomerId` key.
- `campanha` + `originId` builds the same way.
- `amigo` + `referrerCustomerId` builds, and `toJSON()` is `{ categoryId: 'amigo', referrerCustomerId }`. No `originId` key.
- Unknown `categoryId`, `''`, and `'CANAL'` throw `CustomerIndicationInvalidError`.
- `canal` without `originId`, with `originId: null`, with both ids, or with `referrerCustomerId: ""` throws `CustomerIndicationInvalidError`.
- `amigo` without `referrerCustomerId`, or with an `originId` (including `""`), throws `CustomerIndicationInvalidError`.
- `canal` with `originId: ""` throws `InvalidUniqueEntityIdError`.
- `canal` with a non-string `originId` throws `CustomerIndicationInvalidError`.
- Uppercase 24-hex is accepted and stored lowercase.
- `reconstitute` of an origin snapshot does not throw when the origin would be ended or missing; it returns the same snapshot from `toJSON()`.
- `ensureOriginIsLinkable(null)` → `CustomerIndicationOriginNotFoundError`.
- facts whose `categoryId` differs → `CustomerIndicationOriginCategoryMismatchError`, including when `active` is `false`.
- facts with the same `categoryId` and `active: false` → `CustomerIndicationOriginEndedError`.
- facts with the same `categoryId` and `active: true` returns. `id` is ignored.
- `ensureOriginIsLinkable` on a friend throws a plain `Error`, not a `DomainError`.
- `ensureReferrerExists(false)` on a friend → `CustomerReferrerNotFoundError`. `true` returns.
- `ensureReferrerExists` on an origin throws a plain `Error`.

`customer.spec.ts` (keep the existing name, email, phone, nif, and identity cases)

- `create` without `indication` has `toJSON().rank === 'BRONZE'` and `toJSON().indication === null`.
- `create` with a valid origin indication stores that snapshot and `rank === 'BRONZE'`.
- `create` with an invalid indication throws and does not return a customer.
- `create` input has no `rank` field. A customer built by `create` is Bronze.
- `reconstitute` with `rank: 'SILVER'` and `indication: null` round-trips both.
- `reconstitute` with an `Indication` round-trips `toJSON().indication`.
- `customer.model.spec.ts` expects `rank: 'BRONZE'` and `indication: null` on a customer created without an indication.

## Acceptance criteria

- [ ] A new customer is Bronze, and `Customer.create` cannot be given a rank.
- [ ] `reconstitute` can hold `BRONZE`, `SILVER`, or `GOLD`.
- [ ] An indication is one of the two shapes, or it cannot be built.
- [ ] `""` counts as sent. Only `undefined` and `null` are absent.
- [ ] Origin linkability and referrer existence are pure methods. They take plain data and call no port.
- [ ] This module does not import `@modules/indications`.

## Out of scope

- Persistence, the use case, HTTP, and both module factories.
- A rank transition.
- Validating the origin or the referrer inside `Indication.create` or `Customer.create`.

## Checklist

- [ ] `Rank` is the closed set above, with `INITIAL_RANK === 'BRONZE'`, and no transition function.
- [ ] `Indication.create` follows the order in section 3.
- [ ] `ensureOriginIsLinkable` checks null, then category, then `active`.
- [ ] The five new errors exist, and `CustomerAlreadyExistsError` is unchanged.
- [ ] `Customer.create` sets Bronze and an optional indication. `reconstitute` restores the stored rank.
- [ ] Existing phone, nif, name, and email behaviour still passes.
- [ ] No file under `infrastructure/`, `application/`, or `presentation/` changed.
