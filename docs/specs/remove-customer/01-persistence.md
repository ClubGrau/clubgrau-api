# Spec: Slice 1 — Customers persistence

> Store `removedAt`, write the anonymization, and make every read aware of it.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-domain.md`](./00-domain.md).  
> Design §11 / [ADR 0004](../../adr/remove-customer/0004-removed-customer-leaves-the-base-but-stays-in-history.md).  
> Next: [`02-application.md`](./02-application.md).

## Responsibility (this spec only)

Schema, mapper, and `CustomerMongooseRepository`. The outbound ports that this repository implements are born here, with their methods.

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `removedAt` on the schema and the mapper | Yes |
| `FindCustomerByIdPort`, `RemoveCustomerRepositoryPort` + methods | Yes |
| Rename `ExistsCustomerByIdPort` → `ExistsReferrableCustomerByIdPort` | Yes |
| `ReferrerNameReadModel` and the new `FindCustomerNamesByIdsPort` result | Yes |
| `findAll` filters removed | Yes |
| Use cases, query, controller | **No** |

**Prompt sketch for the agent:**

> Implement slice 1 of Remove Customer following [`docs/specs/remove-customer/01-persistence.md`](./01-persistence.md).  
> Add `removedAt` to the schema and mapper; add `findById` and a guarded `remove`; rename `existsById` to `existsReferrableById` filtering removed; filter removed in `findAll`; return `removed` from `findNamesByIds`. Do not edit use cases or the query.

## Schema

File: `infrastructure/outbound/persistence/customer.schema.ts`.

```ts
removedAt: { type: Date, default: null },
```

No index. No migration: a document without the field matches `{ removedAt: null }`.

## Mapper

File: `infrastructure/outbound/persistence/customer.mapper.ts`.

- `mapCustomerDocument` returns `removedAt: document.removedAt ?? null`.
- `mapToCreateDocument` writes `removedAt` from the snapshot.
- `mapCustomerReadModel` does **not** expose `removedAt`. The listing never returns removed customers, so the read model does not need it.

## Ports

All under `application/ports/outbound/`. One method each.

```ts
// find-customer-by-id.port.ts
export interface FindCustomerByIdPort {
  findById(id: string): Promise<CustomerModel.toCreate | null>
}

// remove-customer-repository.port.ts
export interface RemoveCustomerRepositoryPort {
  /** `false` when the customer was already removed (or does not exist). */
  remove(customer: CustomerModel.toCreate): Promise<boolean>
}

// exists-referrable-customer-by-id.port.ts  (replaces exists-customer-by-id.port.ts)
export interface ExistsReferrableCustomerByIdPort {
  existsReferrableById(id: string): Promise<boolean>
}
```

Delete `exists-customer-by-id.port.ts`. Do not keep both.

`FindCustomerNamesByIdsPort` changes its result:

```ts
// application/dtos/get-customers.dto.ts
export interface ReferrerNameReadModel {
  id: string
  name: string
  removed: boolean
}

// find-customer-names-by-ids.port.ts
findNamesByIds(ids: string[]): Promise<ReferrerNameReadModel[]>
```

`NameByIdReadModel` stays as it is. `FindIndicationOriginNamesByIdsPort` still uses it.

## Repository

File: `infrastructure/outbound/persistence/customer-mongoose.repository.ts`. Add `FindCustomerByIdPort` and `RemoveCustomerRepositoryPort` to `implements`; replace `ExistsCustomerByIdPort` with `ExistsReferrableCustomerByIdPort`.

| Method | Behaviour |
|--------|-----------|
| `findById(id)` | `Types.ObjectId.isValid(id)` false → `null`. Otherwise `findOne({ _id: id }).lean()` → `mapCustomerDocument` or `null`. Returns removed customers too |
| `remove(customer)` | `updateOne({ _id: customer.id, removedAt: null }, { $set: { email, phone: null, removedAt }, $unset: { nif: '' } })`. Returns `matchedCount === 1` |
| `existsReferrableById(id)` | `Model.exists({ _id: id, removedAt: null })` → non-null is `true`. `try/catch` → `false` for a malformed id |
| `findAll(params)` | `buildFindFilter` always sets `removedAt: null`. `countDocuments` uses the same filter, so `total` and `search` follow |
| `findNamesByIds(ids)` | `.select('_id name removedAt')`. Returns `{ id, name, removed: document.removedAt != null }`. Does **not** filter removed |
| `findByEmail` | Unchanged. A removed customer holds the sentinel, so the original email is free |

`remove` writes only the fields that change. Do not `replaceOne`, and do not write `name`, `rank`, `indication`, or `createdAt`.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer.schema.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer.mapper.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository.ts` |
| Edit | `src/modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository.spec.ts` |
| Edit | `src/modules/customers/application/dtos/get-customers.dto.ts` |
| Edit | `src/modules/customers/application/ports/outbound/find-customer-names-by-ids.port.ts` |
| Create | `src/modules/customers/application/ports/outbound/find-customer-by-id.port.ts` |
| Create | `src/modules/customers/application/ports/outbound/remove-customer-repository.port.ts` |
| Create | `src/modules/customers/application/ports/outbound/exists-referrable-customer-by-id.port.ts` |
| Delete | `src/modules/customers/application/ports/outbound/exists-customer-by-id.port.ts` |

## Spec expectations

`customer-mongoose.repository.spec.ts` (Mongo memory helpers):

- `create` then `findById` → snapshot with `removedAt: null`.
- `findById` with an unknown id → `null`; with a malformed id → `null`.
- `remove` on a stored customer → `true`; the document has the sentinel email, `phone` `null`, no `nif`, `removedAt` set; `name`, `rank`, `indication`, `createdAt` unchanged.
- `remove` a second time → `false`, document unchanged.
- After `remove`, `create` with the original email succeeds (no `11000`).
- `existsReferrableById` → `true` for a stored customer, `false` after it is removed, `false` for an unknown or malformed id.
- `findAll` → a removed customer is not in `items` and not in `total`; a `search` by its name does not find it.
- `findNamesByIds` → returns the removed customer with its name and `removed: true`; others have `removed: false`.
- Rename the existing `existsById` cases to `existsReferrableById`.

## Acceptance criteria

- [ ] `removedAt` round-trips through schema and mapper.
- [ ] `remove` is guarded by `removedAt: null` and reports whether it matched.
- [ ] No list result and no referrer check ever sees a removed customer.
- [ ] The name lookup still sees removed customers and flags them.
- [ ] `exists-customer-by-id.port.ts` no longer exists.

## Out of scope

- Callers of the renamed port and the new result type (slice 2).
- Wiring (slice 5).

## Checklist

- [ ] Schema field with `default: null`, no index.
- [ ] Three ports created, one deleted, one result type changed.
- [ ] `findById` returns removed customers; `existsReferrableById` and `findAll` do not.
- [ ] `remove` uses `updateOne` with the guard and `$unset` for `nif`.
- [ ] Repository specs cover each row above.
