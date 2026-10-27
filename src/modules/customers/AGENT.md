# Customers Module — Agent Guide

> Living **contract** of the customers hexagon (create customer with rank and an optional indication, plus the paginated list query).
>
> Global rules (architecture, naming, testing, playbooks): [`AGENTS.md`](../../../AGENTS.md).
> Structure diagrams / folder tree: [`docs/project-structure.md`](../../../docs/project-structure.md).
> Ubiquitous language: [`CONTEXT.md`](./CONTEXT.md).
> Shipped: rank and indication on create — [design](../../../docs/design-docs/customer-ranking-indications-v1.md), [PRD](../../../docs/prd/customer-ranking-indications-v1.md), [specs](../../../docs/specs/customer-ranking-indications/README.md). ADRs: [`docs/adr/customer-ranking-indications/`](../../../docs/adr/customer-ranking-indications/).
> Open follow-up: a rank-transition PRD (what moves a customer to Silver or Gold). Not started.

## Purpose of this document

Use this file to extend **this** module without breaking its current contracts: public HTTP surface, ports, DTOs, domain invariants, persistence mapping, and wiring specific to customers.

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** when any of these change for customers: a route or response shape, a domain invariant, a port or DTO, a schema field or mapper rule, a resolved open decision, or the module layout. Global convention changes belong in [`AGENTS.md`](../../../AGENTS.md).

`Current contract` describes what the code does today. `Future work` and `Open decisions` are not current behaviour.

---

## Module status

### Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| Create customer (command) | Done | `POST /api/customer` — stores `rank` (born `BRONZE`) and an optional indication |
| List customers (query) | Done | `GET /api/customers` — offset pagination + `rank` / `search`; indication carries the origin or referrer name |
| Email availability policy | Done | `CustomerPoliciesService.ensureEmailIsAvailable`; a taken email is `409` |
| Origin and referrer checks | Done | `FindIndicationOriginPort` (injected) and `ExistsCustomerByIdPort` |
| Origin names for list | Done | `FindIndicationOriginNamesByIdsPort` (injected; implemented by `indications`) |
| Mongo persistence | Done | `CustomerMongooseRepository` |
| Auth gate | Done | `authTokenMiddleware` on create and list (any authenticated employee, no `requireRoles`) |
| Composition root wiring | Done | `customers.module.ts` receives `findIndicationOrigin` + `findIndicationOriginNamesByIds`; `app.ts` builds indications first |

### Future work

Left for a later PRD. None of these is half-implemented here:

- A rank transition (Silver, Gold) and any endpoint that changes a rank
- Customer get-by-id, summary by rank, "Indicou N", and the customer search a friend picker needs (list is shipped)
- Changing or removing an indication after create
- Update, deactivate, or delete a customer
- Customer login, password, or any auth subject

---

## Directory map (today)

```text
src/modules/customers/
├── AGENT.md
├── CONTEXT.md
├── customers.module.ts
│
├── domain/
│   ├── entities/
│   │   ├── Customer.ts
│   │   └── customer.spec.ts
│   ├── models/
│   │   ├── customer.model.ts
│   │   ├── customer.model.spec.ts
│   │   └── indication-origin-facts.ts
│   ├── ports/
│   │   └── find-customer-by-email.port.ts
│   ├── errors/
│   │   └── customer.errors.ts
│   ├── services/
│   │   ├── customer-policies.service.ts
│   │   └── customer-policies.service.spec.ts
│   ├── value-objects/
│   │   ├── indication.vo.ts
│   │   └── indication.vo.spec.ts
│   ├── rank.ts
│   └── rank.spec.ts
│
├── application/
│   ├── dtos/
│   │   ├── create-customer.dto.ts
│   │   ├── create-customer.dto.spec.ts
│   │   ├── get-customers.dto.ts
│   │   └── get-customers.dto.spec.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   ├── create-customer.port.ts
│   │   │   └── get-customers.port.ts
│   │   └── outbound/
│   │       ├── create-customer-repository.port.ts
│   │       ├── exists-customer-by-id.port.ts
│   │       ├── find-indication-origin.port.ts
│   │       ├── find-indication-origin-names-by-ids.port.ts
│   │       ├── find-customers.port.ts
│   │       └── find-customer-names-by-ids.port.ts
│   ├── usecases/
│   │   ├── create-customer.usecase.ts
│   │   └── create-customer.usecase.spec.ts
│   └── queries/
│       ├── get-customers.query.ts
│       └── get-customers.query.spec.ts
│
├── presentation/
│   ├── http/
│   │   ├── create-customer.request.ts
│   │   └── get-customers.request.ts
│   └── controllers/
│       ├── create-customer.controller.ts
│       ├── create-customer.controller.spec.ts
│       ├── get-customers.controller.ts
│       └── get-customers.controller.spec.ts
│
└── infrastructure/
    ├── inbound/http/
    │   └── customer.routes.ts
    └── outbound/persistence/
        ├── customer.schema.ts
        ├── customer.mapper.ts
        ├── customer-mongoose.repository.ts
        └── customer-mongoose.repository.spec.ts
```

---

## Current contract

### Domain model

`Customer` has `id`, `name` (`Name`), `email` (`Email`), `phone` (`Phone` or `null`), `nif` (`Nif` or `null`), `createdAt`, `rank`, and `indication` (`Indication` or `null`). It has no password, role, or active flag. `Customer.create` builds a new customer. `Customer.reconstitute` rebuilds one from persistence. Getters expose `rank` and `indication`. There is no `changeRank`.

`Rank` is the closed set `BRONZE`, `SILVER`, `GOLD`. A customer is **born `BRONZE`** (`INITIAL_RANK`). `Customer.create` takes no `rank`.

Email is unique among customers. Emails may overlap with employees: there is no cross-collection check.

`Indication` has two shapes. Origin: `canal` or `campanha` plus `originId`. Friend: `amigo` plus `referrerCustomerId`. Both ids together, a missing id, or the id of the other shape is refused. Only a missing key or `null` means "not sent". Any other value, including `""`, counts as sent. An indication is **all or nothing**: an invalid one refuses the whole create.

The domain calls **no port**. The use case loads facts and passes them as plain data to `Indication.ensureOriginIsLinkable(facts)` and `ensureReferrerExists(exists)`. `customers` does **not** import `@modules/indications/domain`. The three category codes are written again in this module on purpose ([ADR 0002](../../../docs/adr/customer-ranking-indications/0002-indication-is-an-embedded-value-object-owned-by-customers.md)).

Ending an origin never changes a customer already linked to it.

### Errors

| Error | When |
|-------|------|
| `CustomerAlreadyExistsError` | The email is already used by a customer |
| `CustomerIndicationInvalidError` | Unknown category, incoherent shape, or an indication that is not an object |
| `CustomerIndicationOriginNotFoundError` | The origin id has no row |
| `CustomerIndicationOriginCategoryMismatchError` | The origin belongs to the other category |
| `CustomerIndicationOriginEndedError` | The origin is ended |
| `CustomerReferrerNotFoundError` | The referrer customer id has no row |
| `InvalidNameError`, `InvalidEmailError`, `InvalidPhoneFormatError`, `InvalidNifError`, `InvalidUniqueEntityIdError` (shared) | VO validation, including a malformed indication id |

### Application: Create Customer (command)

Port: `CreateCustomerPort`. DTO: `{ name, email, phone?, nif?, indication? }` → `{ id }`. `indication` is `{ categoryId, originId?, referrerCustomerId? }` or `null`.

1. `Customer.create(...)` then `.toJSON()` (VO validation and the indication shape happen here; rank is `BRONZE`)
2. `CustomerPoliciesService.ensureEmailIsAvailable(email)`
3. When the indication is an origin (`canal` or `campanha`): `FindIndicationOriginPort.findOrigin(originId)`, then `indication.ensureOriginIsLinkable(facts)`
4. When the indication is a friend (`amigo`): `ExistsCustomerByIdPort.existsById(referrerCustomerId)`, then `indication.ensureReferrerExists(exists)`
5. `CreateCustomerRepositoryPort.create(snapshot)`
6. Return `{ id }`

`ExistsCustomerByIdPort` is this module's repository. `FindIndicationOriginPort` is declared here and implemented in `indications` (`IndicationOriginLookupAdapter`). Do not read the `origins` collection from this module ([ADR 0001](../../../docs/adr/customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md)). There is no Mongo transaction ([ADR 0003](../../../docs/adr/customer-ranking-indications/0003-no-transaction-on-create-customer.md)).

### Application: Get Customers (query)

Offset pagination lives in `@shared/application/pagination` (`normalizePagination`, `toPaginatedResult`). Module DTOs compose that contract. Defaults: `page=1`, `limit=20`, `max limit=100`.

```ts
interface GetCustomersDto extends PaginationInputDto {
  rank?: Rank;
  search?: string;
}

type GetCustomersIndicationDto =
  | { categoryId: 'canal' | 'campanha'; originId: string; name: string | null }
  | { categoryId: 'amigo'; referrerCustomerId: string; name: string | null };

interface GetCustomersItemDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  nif: string | null;
  createdAt: Date;
  rank: Rank;
  indication: GetCustomersIndicationDto | null;
}

interface GetCustomersResultDto {
  customers: GetCustomersItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

`FindCustomersPort.findAll` returns the same fields with `indication` as the stored snapshot (ids only). The query then composes names ([ADR 0005](../../../docs/adr/customer-ranking-indications/0005-cross-module-reads-are-composed-in-the-query-through-ports.md)):

1. `normalizePagination` → `{ page, limit, skip }`
2. Trim `search` (blank → omit); forward `rank` as-is
3. `FindCustomersPort.findAll({ rank, search, skip, limit })` → `{ items, total }`
4. Collect unique origin ids and unique referrer ids from the page
5. In parallel: `FindIndicationOriginNamesByIdsPort.findOriginNamesByIds` (implemented by `indications`) and `FindCustomerNamesByIdsPort.findNamesByIds` (this module's repository). Empty id lists skip the call
6. Merge `name` onto each indication. A stored id with no row → `name: null`. Walk-in → `indication: null`
7. `toPaginatedResult` → `{ customers, page, limit, total, totalPages }`

`total` / `totalPages` always reflect the **filtered** set. No domain entity, no policies, no `populate` / `$lookup`.

### Presentation and HTTP

```text
authTokenMiddleware → adaptRoute
```

`app.ts` mounts the router at `/api`. Paths inside the router have no `/api` prefix.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/api/customers` | `200` `{ data: { customers, page, limit, total, totalPages } }` |
| `POST` | `/api/customer` | `201` `{ data: { id } }` |

`GetCustomersController` has no required fields. It normalizes the query string: `rank` via `isRank` (`BRONZE` \| `SILVER` \| `GOLD`), `search` (trim), `page`, `limit`. Invalid `rank` → `400` `InvalidParamError`. Blank `rank` / `search` are omitted. Success → `200` + `{ data: { customers, page, limit, total, totalPages } }`.

```http
GET /api/customers?page=1&limit=20&rank=BRONZE&search=maria
```

`CreateCustomerController` checks `name` and `email` with `validationRequiredFields` (a falsy value is `MissingParamError`, `400`). When `indication` is a plain object it also checks `categoryId`; a miss is `MissingParamError` with field `indication.categoryId` (`400`). It forwards `name`, `email`, `phone`, `nif`, and `indication`. A `rank` in the body is not forwarded.

| Situation | HTTP |
|-----------|------|
| List | `200` `{ data: { customers, page, limit, total, totalPages } }` |
| Invalid `rank` on list | `400` |
| Created, with or without indication | `201` `{ data: { id } }` |
| Missing `name`, `email`, or `indication.categoryId` | `400` |
| Invalid name, email, phone, nif | `400` |
| Unknown category, incoherent shape, malformed id, indication that is not an object | `400` |
| Unknown, wrong-category, or ended origin; unknown referrer | `400` |
| Email already used | `409` |
| No / invalid session | `401` |
| Unexpected | `500` |

This API has no `404`.

Samples: `src/client/customer.http`.

### Persistence

- Model name: `Customer`
- Fields: `name`, `email` (unique index), `phone`, `nif`, `createdAt`, `rank` (enum `BRONZE` \| `SILVER` \| `GOLD`, required), embedded `indication` (`categoryId`, `originId`, `referrerCustomerId`)
- Indication ids are plain `ObjectId`, with **no** Mongoose `ref`. Do not use `populate()` or `$lookup` into `origins`.
- `CustomerMongooseRepository` implements `CreateCustomerRepositoryPort` (`create`), `FindCustomerByEmailPort` (`findByEmail`), `ExistsCustomerByIdPort` (`existsById` via `Model.exists`), `FindCustomersPort` (`findAll`), and `FindCustomerNamesByIdsPort` (`findNamesByIds`)
- `findAll` sorts by `{ createdAt: -1, _id: -1 }` for stable pages. Optional `search` builds a case-insensitive `$or` over `name`, `email`, `phone`, and `nif` (`$expr` + `$toString` because `nif` is stored as Number). Regex metacharacters in `search` are escaped. `countDocuments` uses the same filter
- `findNamesByIds` selects `_id` and `name` only. Malformed ids are skipped. A missing id is omitted from the result (the query maps it to `name: null`)
- Duplicate key `11000` on email becomes `CustomerAlreadyExistsError`
- The mapper keeps Mongoose types out of the domain. `nif` is stored as a number and read back as a string. `mapCustomerDocument` → write snapshot. `mapCustomerReadModel` → `FindCustomersItem` (indication ids only; names are composed in the query)

### Wiring (`customers.module.ts`)

Factory: `makeCustomersModule({ connection, authTokenMiddleware, findIndicationOrigin, findIndicationOriginNamesByIds })`.

`app.ts` builds `makeIndicationsModule` first and passes `indications.findIndicationOrigin` and `indications.findIndicationOriginNamesByIds`.

1. `connection.model('Customer', CustomerSchema)`
2. One `CustomerMongooseRepository`
3. `CustomerPoliciesService(repository)` — same instance, `FindCustomerByEmailPort`
4. `CreateCustomerUsecase(policies, findIndicationOrigin, repository, repository)` — `ExistsCustomerByIdPort` and `CreateCustomerRepositoryPort`
5. `CreateCustomerController(createCustomer)`
6. `GetCustomersQuery(repository, findIndicationOriginNamesByIds, repository)` — `FindCustomersPort` + `FindCustomerNamesByIdsPort`
7. `GetCustomersController(getCustomers)`
8. `makeCustomerRoutes({ createCustomerController, getCustomersController, authTokenMiddleware })`

Returns `{ createCustomerController, getCustomersController, createCustomer, getCustomers, router }`.

**Rule:** when adding a use case or query, wire it in this file. Do not construct the repository inside a controller or a use case. Do not construct a second customer repository.

---

## Open decisions / known limitations

1. **Rank climb** — what moves a customer to Silver or Gold, and whether a referral counts. Owner: the domain expert. Blocks the rank-transition PRD. No method, use case, or route changes a rank today.
2. **Customer read** — list is shipped (`GET /api/customers`, ADR 0005). Remaining: get-by-id, summary by rank, "Indicou N", and the customer search a friend picker needs. Until the picker exists, the API accepts Amigo but the frontend cannot pick a real friend. A stored indication id with no row shows `name: null`.
3. **Correcting an indication after create** — not planned.
4. **Email across modules** — customer and employee emails may overlap. No cross-collection uniqueness.
