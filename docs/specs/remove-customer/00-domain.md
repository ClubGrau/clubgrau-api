# Spec: Slice 0 — Customers domain

> The customer can be removed, once.  
> Parent: [`README.md`](./README.md).  
> Design §7 / [ADR 0001](../../adr/remove-customer/0001-customer-remove-is-anonymization-keeping-the-name.md), [ADR 0002](../../adr/remove-customer/0002-removed-is-marked-by-removed-at-not-a-status.md).  
> Next: [`01-persistence.md`](./01-persistence.md).

## Responsibility (this spec only)

`Customer` holds `removedAt` and owns the anonymization rule. The domain calls no port and knows nothing about passwords or HTTP.

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `removedAt` on `Customer` props, create, reconstitute | Yes |
| `remove(now)`, `isRemoved` + specs | Yes |
| `CustomerNotFoundError`, `CustomerAlreadyRemovedError`, `CustomerActorAuthenticationFailedError` | Yes |
| Schema, mapper, repository | **No** |
| Use case, ports, DTOs | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Remove Customer following [`docs/specs/remove-customer/00-domain.md`](./00-domain.md).  
> Add `removedAt` to `Customer`, a `remove(now)` method that anonymizes and refuses a second call, and the three errors. Do not touch persistence or application.

## `Customer`

File: `domain/entities/Customer.ts`.

```ts
interface CustomerProps {
  // ... existing
  removedAt: Date | null
}

interface ReconstituteCustomerProps {
  // ... existing
  removedAt?: Date | null
}
```

- `Customer.create(...)` sets `removedAt: null`. `CreateCustomerProps` does not accept `removedAt`.
- `Customer.reconstitute(input)` sets `removedAt: input.removedAt ?? null`.
- `get removedAt(): Date | null`.
- `get isRemoved(): boolean` returns `removedAt !== null`.

### `remove(now: Date): void`

1. `isRemoved` → throw `CustomerAlreadyRemovedError`. Nothing changes.
2. `this.props.email = Email.create(\`removed.${this.id}@anonymized.invalid\`)`.
3. `this.props.phone = null`.
4. `this.props.nif = null`.
5. `this.props.removedAt = now`.

`name`, `rank`, `indication`, and `createdAt` are not touched. Use the same sentinel format as `Employee.anonymize()`. `now` is a parameter so the spec controls time; do not call `new Date()` inside.

`toJSON()` now includes `removedAt` through `Entity.toJSON()`. `CustomerModel.toCreate` picks it up from `ReturnType<Customer['toJSON']>`; do not edit `customer.model.ts`.

## Errors

File: `domain/errors/customer.errors.ts`. Each extends `DomainError`.

| Error | Message |
|-------|---------|
| `CustomerNotFoundError` | `Customer was not found` |
| `CustomerAlreadyRemovedError` | `Customer is already removed` |
| `CustomerActorAuthenticationFailedError` | `Authentication failed` |

`CustomerActorAuthenticationFailedError` must not say whether the actor exists or the password was wrong. Do not import `ActorAuthenticationFailedError` from `employees`.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/customers/domain/entities/Customer.ts` |
| Edit | `src/modules/customers/domain/entities/customer.spec.ts` |
| Edit | `src/modules/customers/domain/errors/customer.errors.ts` |

## Spec expectations

`customer.spec.ts`:

- `create` → `removedAt` is `null`, `isRemoved` is `false`, `toJSON().removedAt` is `null`.
- `reconstitute` without `removedAt` → `null`. With a date → that date, `isRemoved` is `true`.
- `remove(now)` on a customer with phone, NIF, and a Friend indication → same `id`, same `name`, `email` is `removed.<id>@anonymized.invalid`, `phone` `null`, `nif` `null`, `removedAt` is `now`; `rank`, `indication`, and `createdAt` equal the values before.
- `remove` twice → the second call throws `CustomerAlreadyRemovedError`, and `removedAt` keeps the first date.
- `remove` on a reconstituted removed customer → throws `CustomerAlreadyRemovedError`.
- The sentinel email of two different customers differs.

Keep every existing case green.

## Acceptance criteria

- [ ] A new customer is born with `removedAt: null`.
- [ ] `remove(now)` keeps id, name, rank, indication, and `createdAt`, and erases email, phone, and NIF.
- [ ] A second `remove` throws `CustomerAlreadyRemovedError` and changes nothing.
- [ ] The domain imports nothing from `application`, `infrastructure`, or another module.

## Out of scope

- Persisting `removedAt` (slice 1).
- Who may remove and the password (slices 2 to 4).
- A restore method. Do not add one.

## Checklist

- [ ] `removedAt` in props, create, reconstitute, getter.
- [ ] `isRemoved` getter.
- [ ] `remove(now)` follows the five steps in order.
- [ ] Three errors added with the messages above.
- [ ] Existing customer specs still pass.
