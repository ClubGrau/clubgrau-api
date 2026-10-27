# Spec: Slice 1 — Customers persistence (rank and indication)

> Store the rank and the embedded indication on the customer document.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md) (`Rank`, `IndicationSnapshot` via `Customer.toJSON()`, `CustomerAlreadyExistsError`).  
> Design §11 / [ADR 0003](../../adr/customer-ranking-indications/0003-no-transaction-on-create-customer.md) / [ADR 0005](../../adr/customer-ranking-indications/0005-cross-module-reads-are-composed-in-the-query-through-ports.md).  
> Next: [`02-application.md`](./02-application.md).

## Responsibility (this spec only)

Persist `rank` and, when present, one embedded indication. Translate a duplicate email key into `CustomerAlreadyExistsError`. Answer whether a customer id exists. Do not decide whether an origin may be linked.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-domain.md) | Snapshot shape, rank, errors |
| **This file** | Schema, mapper, `existsById`, `ExistsCustomerByIdPort`, `11000` |
| [`02`](./02-application.md) | The use case calls `existsById` only for a friend indication |

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `customer.schema.ts` | Yes |
| `customer.mapper.ts` | Yes |
| `existsById` on `CustomerMongooseRepository` + spec | Yes |
| `application/ports/outbound/exists-customer-by-id.port.ts` | Yes — the repository implements it. Slice 2 must not declare a second one |
| `11000` on `create` → `CustomerAlreadyExistsError` | Yes |
| `FindIndicationOriginPort`, use case, controller | **No** |
| A transaction, a new index, a `ref`, `populate`, or `$lookup` | **No** |
| `customers.module.ts` | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/01-persistence.md`](./01-persistence.md).  
> Add `rank` and an embedded `indication` with `ObjectId` ids and no `ref`. `existsById` returns false for a malformed id. Duplicate key `11000` on create becomes `CustomerAlreadyExistsError`.  
> Do not add the use case, the origin port, or a transaction.

## Schema

File: `infrastructure/outbound/persistence/customer.schema.ts`.

Keep the model name `Customer`. Keep `email` unique. Keep `name`, `phone`, `nif`, and `createdAt` as they are. Do not enable `timestamps`.

```ts
{
  name: string
  email: string                      // unique, as today
  phone: string | null
  nif: number
  createdAt: Date
  rank: 'BRONZE' | 'SILVER' | 'GOLD' // required enum
  indication?: {                     // omit the path when there is no indication
    categoryId: 'canal' | 'campanha' | 'amigo' // required enum inside the sub-document
    originId?: ObjectId              // origin shape
    referrerCustomerId?: ObjectId    // friend shape
  }                                  // _id: false on the sub-document
}
```

`indication.originId` and `indication.referrerCustomerId` are `Schema.Types.ObjectId`. They have no `ref`. No index on either path. No migration: no customers are stored before this feature.

## Port

File: `application/ports/outbound/exists-customer-by-id.port.ts`.

```ts
export interface ExistsCustomerByIdPort {
  existsById(id: string): Promise<boolean>
}
```

One method. The repository class adds `implements ExistsCustomerByIdPort` next to the two ports it already implements.

## Mapper

Keep Mongoose types out of the domain. Map explicitly. Do not persist `toJSON()` by spreading `indication` through: a spread would write string ids.

**Write** (`mapToCreateDocument`):

- `rank` is the snapshot string.
- `indication === null`: the payload has no `indication` property. Do not write `indication: null`.
- Origin snapshot: `{ categoryId, originId: ObjectId }`. No `referrerCustomerId`.
- Friend snapshot: `{ categoryId: 'amigo', referrerCustomerId: ObjectId }`. No `originId`.
- `nif` stays a number or `null`, as today. `_id` stays `ObjectId` from the snapshot id.

**Read** (`mapCustomerDocument`):

- `rank` is the stored string.
- Missing `indication` maps to `null`.
- Origin sub-document maps to `{ categoryId, originId: string }`.
- Friend sub-document (`categoryId === 'amigo'`) maps to `{ categoryId: 'amigo', referrerCustomerId: string }`.
- Do not call `Indication.create` or `Customer.reconstitute` on read. `findByEmail` still returns `CustomerModel.toCreate`.

## Repository

`create` persists the mapped document. When the driver rejects with `code === 11000`, throw `new CustomerAlreadyExistsError()`. Any other error propagates. The only unique index is email, so every `11000` on this collection is a taken email. Match the check in `IndicationOriginMongooseRepository.isDuplicateKey` (`typeof err === 'object'`, `'code' in err`, `code === 11000`). Do not open a session or a transaction.

`findByEmail` stays the same query. The mapped result includes `rank` and `indication`.

`existsById(id)`:

- Returns `true` when a document has that `_id`.
- Returns `false` when none does.
- A malformed id returns `false` and does not throw. Wrap the query in `try/catch` the same way `IndicationOriginMongooseRepository.findById` does (`findById` + `lean`, or `exists`). Do not translate it into `InvalidUniqueEntityIdError`. The domain already refused a malformed id before a normal create; this method is the safe answer for a bad string.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer.schema.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer.mapper.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository.spec.ts` |
| Create | `src/modules/customers/application/ports/outbound/exists-customer-by-id.port.ts` |

## Spec expectations

Update the existing `create` and `findByEmail` fixtures so every `CustomerModel.toCreate` includes `rank` and `indication`. A walk-in fixture uses `rank: 'BRONZE'` and `indication: null`, and the document passed to `create` has `rank: 'BRONZE'` and no `indication` key.

- `create` with an origin indication calls `model.create` with `indication.originId` as an `ObjectId` of that hex, `indication.categoryId` `'canal'` or `'campanha'`, and no `referrerCustomerId`.
- `create` with a friend indication calls `model.create` with `indication.referrerCustomerId` as an `ObjectId` and no `originId`.
- `create` rejected with `{ code: 11000 }` throws `CustomerAlreadyExistsError`.
- `create` rejected with any other error rejects with that error.
- `findByEmail` maps a stored origin indication back to string ids, and maps a missing indication to `null`, and maps `rank`.
- `existsById` returns `true` when `findById` (or `exists`) yields a document, `false` when it yields null, and `false` when the driver throws on a malformed id.

## Acceptance criteria

- [ ] A walk-in document has `rank: 'BRONZE'` and no `indication` path.
- [ ] An origin or friend indication is one sub-document, with `ObjectId` ids and no `ref`.
- [ ] Duplicate email on insert is `CustomerAlreadyExistsError`.
- [ ] `existsById` is `false` for a missing or malformed id.
- [ ] No transaction and no new index.

## Out of scope

- The use case, `FindIndicationOriginPort`, the controller, and `customers.module.ts`.
- Reading the `origins` collection from this module.

## Checklist

- [ ] Schema matches section Schema, including `_id: false` and no `ref`.
- [ ] Mapper omits `indication` when the snapshot indication is `null`.
- [ ] Mapper converts the one id of the shape to `ObjectId` on write and to a string on read.
- [ ] `ExistsCustomerByIdPort` has only `existsById`.
- [ ] `11000` becomes `CustomerAlreadyExistsError`. Other errors propagate.
- [ ] Existing phone and nif mapping still passes.
