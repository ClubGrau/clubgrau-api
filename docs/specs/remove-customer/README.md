# Specs: Remove Customer (v1)

> Implementation contracts for the slices in design-doc §14.  
> Design: [`docs/design-docs/remove-customer-v1.md`](../../design-docs/remove-customer-v1.md).  
> PRD: [`docs/prd/remove-customer-v1.md`](../../prd/remove-customer-v1.md) (v1.0).  
> Glossary: [`src/modules/customers/CONTEXT.md`](../../../src/modules/customers/CONTEXT.md) (Customer, Referrer, Remove, Removed customer).  
> ADRs: [`docs/adr/remove-customer/`](../../adr/remove-customer/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull a later slice’s use case, controller, or wiring into an earlier slice.

`customers` and `auth` already exist. This feature extends both. Do not create a new hexagon. Do not touch `employees` or `indications`.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | `Customer` holds `removedAt`; `remove(now)`, `isRemoved`; three new errors |
| 1 | [`01-persistence.md`](./01-persistence.md) | Schema `removedAt`, mapper, `findById`, `remove`, `existsReferrableById` (rename), `findAll` filter, `findNamesByIds` + `removed`. `FindCustomerByIdPort`, `RemoveCustomerRepositoryPort`, `ExistsReferrableCustomerByIdPort`, and `ReferrerNameReadModel` are born here |
| 2 | [`02-application.md`](./02-application.md) | `CustomerSnapshotMapper`, remove DTOs, `RemoveCustomerPort`, `VerifyActorPasswordPort`, `RemoveCustomerUsecase`; create use case on the renamed port; list query `referrerRemoved` |
| 3 | [`03-auth.md`](./03-auth.md) | `ActorPasswordVerifierAdapter` in `auth` |
| 4 | [`04-http.md`](./04-http.md) | `remove-customer.request.ts`, `RemoveCustomerController`, route with `requireRoles`, `customer.http` |
| 5 | [`05-wiring-and-contract.md`](./05-wiring-and-contract.md) | `customers.module.ts`, `auth.module.ts`, `app.ts`; `customers/AGENT.md`, `auth/AGENT.md` |

**Dependencies:** `1` and `2` need `0`. `2` needs the ports from `1`. `3` needs `VerifyActorPasswordPort` from `2`. `4` needs `2`. `5` needs all.

Ports the repository implements are born in slice 1, with the method that implements them. Slice 2 must not declare a second interface for any of them. `VerifyActorPasswordPort` is born in slice 2, because the repository does not implement it.

**Compile seam.** Slice 1 renames `ExistsCustomerByIdPort` and changes the result type of `FindCustomerNamesByIdsPort`. Slice 2 fixes their callers (`CreateCustomerUsecase`, `GetCustomersQuery`). Slice 4 changes the `makeCustomerRoutes` arguments. The factories that call them are slice 5. Until slice 5, `tsc` fails on `customers.module.ts`. Each slice’s own unit specs are the done-check for that slice. Do not add a stub to silence the compiler. Land `0` through `5` on one branch.

Use the glossary. Do not invent parallel terms. Do not use "delete" or "inactive" for this feature. "Actor" is the authenticated employee who removes (`actorId` from the JWT, stamped by `adaptRoute`).

**Out of these slices:** restore, update, inactivity, `removedBy`. A password middleware. An index on `removedAt`. A migration or backfill. A Mongo transaction. Any change to `employees`, `indications`, sales, or rank.
