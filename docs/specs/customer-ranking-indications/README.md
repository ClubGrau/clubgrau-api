# Specs: Customer Rank and Indication on Create (v1)

> Implementation contracts for the slices in design-doc §14.  
> Design: [`docs/design-docs/customer-ranking-indications-v1.md`](../../design-docs/customer-ranking-indications-v1.md).  
> PRD: [`docs/prd/customer-ranking-indications-v1.md`](../../prd/customer-ranking-indications-v1.md) (v1.0).  
> Glossary: [`src/modules/customers/CONTEXT.md`](../../../src/modules/customers/CONTEXT.md) (Rank, Indication, Referrer, Walk-in) and [`src/modules/indications/CONTEXT.md`](../../../src/modules/indications/CONTEXT.md) (Category, Origin, Channel, Campaign, Friend, Linkable origin).  
> ADRs: [`docs/adr/customer-ranking-indications/`](../../adr/customer-ranking-indications/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull a later slice’s use case, controller, or wiring into an earlier slice.

`customers` and `indications` already exist. This feature extends both. Do not create a third hexagon.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | `Rank`; `Indication` + `IndicationOriginFacts`; `Customer` holds `rank` and an optional `indication`; the new errors |
| 1 | [`01-persistence.md`](./01-persistence.md) | Schema (`rank`, embedded `indication`), mapper, `existsById`, `11000` → `CustomerAlreadyExistsError`. `ExistsCustomerByIdPort` is born here, with the method that implements it |
| 2 | [`02-application.md`](./02-application.md) | `CreateCustomerDto.indication`, `FindIndicationOriginPort`, `CreateCustomerUsecase` checks the origin or the referrer before writing |
| 3 | [`03-http.md`](./03-http.md) | `create-customer.request.ts`, controller error map and nested `categoryId` check, `customer.http` |
| 4 | [`04-linkable-origins.md`](./04-linkable-origins.md) | `GetLinkableIndicationOriginsQuery`, its controller and route, `IndicationOriginLookupAdapter`, `indication.http` |
| 5 | [`05-wiring-and-contract.md`](./05-wiring-and-contract.md) | `customers.module.ts`, `indications.module.ts`, `app.ts` build order, both `AGENT.md` files, `CONTEXT-MAP.md` |

**Dependencies:** `1` and `2` need `0`. `3` needs `2`. `4` needs the port from `2` (`FindIndicationOriginPort`) and does not need `0`, `1`, or `3`. `5` needs `2`, `3`, and `4`.

`ExistsCustomerByIdPort` is created in slice 1, not slice 2. The design lists “the two outbound ports” on slice 2 because that is when the use case starts calling both. The port the customer repository implements is born with the method, the same way the indication-catalog write port was born with the repository. Slice 2 must not declare a second `existsById` interface.

**Compile seam.** Slice 2 changes the `CreateCustomerUsecase` constructor. Slice 4 changes the `makeIndicationRoutes` arguments. The factories that call them are slice 5. Until slice 5, `tsc` fails on `customers.module.ts` and then on `indications.module.ts`. Each slice’s own unit specs are the done-check for that slice. Do not add a stub adapter to silence the compiler. Do not merge a slice that leaves the factories broken; land `0` through `5` on one branch.

Use the glossaries. Do not invent parallel terms. `facts`, `kind`, and `ensureOriginIsLinkable` are implementation names, not glossary terms. "Absent" means the key is missing or its value is `null` or `undefined`. Any other value, including `""`, counts as sent.

**Out of these slices:** any rank transition, and any endpoint that changes a rank. Listing or reading customers. Changing or removing an indication after create. A migration or backfill. A Mongo transaction. An index on `indication.originId` or `indication.referrerCustomerId`. A Mongoose `ref`, `populate()`, or `$lookup`. Changing `requireRoles` on the catalog read or the catalog commands. A friend picker. The indications board.
