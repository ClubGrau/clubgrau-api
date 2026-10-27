# Spec: Slice 5 — Wiring and living contracts

> Connect the two hexagons and record the contract that now exists.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md), [`03-http.md`](./03-http.md), and [`04-linkable-origins.md`](./04-linkable-origins.md).  
> Design §12.  
> Next: none.

## Responsibility (this spec only)

Build `indications` before `customers`, inject the origin lookup, mount the linkable controller, and move the planned contract into the two `AGENT.md` files.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-application.md)–[`04`](./04-linkable-origins.md) | Use case, HTTP, query, adapter, and the route signature already exist |
| **This file** | Both module factories, `app.ts`, `AGENT.md`, `CONTEXT-MAP.md` |

No new behaviour beyond composition. Do not change a rule that an earlier slice defined.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `indications.module.ts` | Yes |
| `customers.module.ts` | Yes |
| `src/app.ts` | Yes |
| `src/modules/customers/AGENT.md` | Yes |
| `src/modules/indications/AGENT.md` | Yes |
| `CONTEXT-MAP.md` | Yes — confirm the relationship sentence; do not add a second one |
| A new use case, query, or route | **No** |

**Prompt sketch for the agent:**

> Implement slice 5 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/05-wiring-and-contract.md`](./05-wiring-and-contract.md).  
> `makeIndicationsModule` builds the linkable query, its controller, and `IndicationOriginLookupAdapter`, passes the controller to `makeIndicationRoutes`, and returns `findIndicationOrigin`.  
> `app.ts` builds indications first and passes that port into `makeCustomersModule`. One customer repository instance is the email port, `ExistsCustomerByIdPort`, and `CreateCustomerRepositoryPort`.  
> Update both `AGENT.md` files so the planned rank-and-indication section becomes the current contract. Do not add a transaction or a rank transition.

## `makeIndicationsModule`

Use the one `IndicationOriginMongooseRepository` already constructed. It implements `ListIndicationOriginsPort` and `FindIndicationOriginByIdPort`.

1. `const findIndicationOrigin = new IndicationOriginLookupAdapter(indicationOriginRepository)`.
2. `const getLinkableIndicationOrigins = new GetLinkableIndicationOriginsQuery(indicationOriginRepository)`.
3. `const getLinkableIndicationOriginsController = new GetLinkableIndicationOriginsController(getLinkableIndicationOrigins)`.
4. Pass that controller into `makeIndicationRoutes`.
5. Return `findIndicationOrigin` on `IndicationsModule`, next to the existing fields. Also return the query and the controller if the module type already returns every controller and port. Match that habit: the file today returns every controller and every inbound port. Add `getLinkableIndicationOriginsController`, `getLinkableIndicationOrigins`, and `findIndicationOrigin`.

Do not construct a second origin repository.

## `makeCustomersModule`

```ts
type CustomersModuleDeps = {
  connection: Connection
  authTokenMiddleware: RequestHandler
  findIndicationOrigin: FindIndicationOriginPort
}
```

Keep one `CustomerMongooseRepository`. It already implements `FindCustomerByEmailPort`, `CreateCustomerRepositoryPort`, and `ExistsCustomerByIdPort`.

```ts
const createCustomer = new CreateCustomerUsecase(
  customerPoliciesService,
  findIndicationOrigin,
  customerRepository,
  customerRepository,
)
```

`CustomerPoliciesService` still receives that same repository. Do not construct a second one.

The controller and `makeCustomerRoutes` stay as slice 3 left them. The route gate does not change.

## `app.ts`

Build `makeIndicationsModule` before `makeCustomersModule`. Pass `indications.findIndicationOrigin` into `makeCustomersModule`.

`app.use` order stays employees, customers, indications, auth. The paths do not overlap. The dependency is the factory argument, not the mount order.

## Living contracts

### `src/modules/customers/AGENT.md`

The file has a `Current contract` and a `Planned: rank and indication` section. Move what this feature shipped into `Current contract`, and delete the planned section. Do not describe planned behaviour as current, and do not leave shipped behaviour under “planned”.

Update, in place:

- **Delivered:** create customer now stores `rank` (born `BRONZE`) and an optional indication. Email taken is `409`. The module receives `findIndicationOrigin`.
- **Directory map:** `rank.ts`, `indication.vo.ts`, `indication-origin-facts.ts`, the two outbound ports, `create-customer.request.ts`.
- **Domain:** rank ladder, born Bronze, the two indication shapes, the new errors, getters, no `changeRank`.
- **Application:** the DTO field, the use-case order (create → email → origin or referrer → repository), and the two ports. `ExistsCustomerByIdPort` is this repository. `FindIndicationOriginPort` is implemented in `indications`.
- **HTTP:** the error table from slice 3. `rank` is not forwarded. Missing `indication.categoryId` is `400`.
- **Persistence:** `rank`, embedded indication, `ObjectId` ids, no `ref`, `existsById`, `11000` → `CustomerAlreadyExistsError`.
- **Wiring:** the new factory argument and the use-case constructor.
- **Future work / open decisions:** keep the rank climb, the customer read, and correcting an indication after create as open. Remove the line that says HTTP mapping is still `500`.
- Point the “next change” banner at this feature as shipped, not as the next change. The rank-transition PRD is the open follow-up.

### `src/modules/indications/AGENT.md`

- **Delivered:** `GET /api/indication-linkable-origins`, any authenticated employee, no `requireRoles`.
- **CQRS:** add `GetLinkableIndicationOriginsQuery` on the query row.
- **Directory map, ports, routes, wiring:** the query, the controller, the route, and `IndicationOriginLookupAdapter` returning `findIndicationOrigin` for `customers`.
- **Future work:** remove “a field on Customer, rank, and the friend row” from the not-built list. The friend row on a customer is the customers feature. This module still does not own a friend entity.
- State that ending or reopening an origin does not write a customer.
- State that the catalog read and the four catalog commands are still `ADMIN` and `MANAGER` only.

### `CONTEXT-MAP.md`

The Customers ↔ Indications relationship is already this sentence:

> Customers asks Indications, through its own outbound port, for an origin's category and whether it is active. The adapter lives in Indications. Customers never imports the Indications domain and keeps its own copy of the three category codes. Ending an origin does not change customers already linked to it.

If that sentence is present, leave it. If a sentence still says Customers is independent of this flow, replace that sentence with the one above. Do not add a second bullet for the same relationship.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/indications/indications.module.ts` |
| Edit | `src/modules/customers/customers.module.ts` |
| Edit | `src/app.ts` |
| Edit | `src/modules/customers/AGENT.md` |
| Edit | `src/modules/indications/AGENT.md` |
| Edit | `CONTEXT-MAP.md` only if the relationship sentence is missing or still says Customers is independent |

## Acceptance criteria

- [ ] `app.ts` constructs indications before customers and passes `findIndicationOrigin`.
- [ ] One customer repository instance is passed to the policy, `existsById`, and `create`.
- [ ] One origin repository instance is passed to the catalog, the linkable query, and the lookup adapter.
- [ ] The linkable route is mounted with `authTokenMiddleware` only.
- [ ] Both `AGENT.md` files describe this feature as the current contract.
- [ ] `tsc` accepts the two factories and `app.ts`.

## Out of scope

- New endpoints, a rank transition, a customer read, a transaction, a `ref`.
- Changing catalog role gates.
- Rewriting `CONTEXT-MAP.md` when the relationship sentence is already the one above.

## Checklist

- [ ] `IndicationsModule` returns `findIndicationOrigin`.
- [ ] `makeIndicationRoutes` receives the linkable controller.
- [ ] `CustomersModuleDeps` requires `findIndicationOrigin`.
- [ ] `CreateCustomerUsecase` is constructed with `(policies, findIndicationOrigin, repository, repository)`.
- [ ] `app.use` order is unchanged.
- [ ] `customers/AGENT.md` no longer has a “Planned: rank and indication” section for behaviour this feature shipped.
- [ ] `indications/AGENT.md` lists the linkable read and the lookup adapter.
- [ ] Catalog routes still require `ADMIN` and `MANAGER`.
