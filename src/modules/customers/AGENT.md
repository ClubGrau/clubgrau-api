# Customers Module — Agent Guide

> Living **contract** of the customers hexagon (create customer today; rank and indication on create next).
>
> Global rules (architecture, naming, testing, playbooks): [`AGENTS.md`](../../../AGENTS.md).
> Structure diagrams / folder tree: [`docs/project-structure.md`](../../../docs/project-structure.md).
> Ubiquitous language: [`CONTEXT.md`](./CONTEXT.md).
> Next change: [`docs/design-docs/customer-ranking-indications-v1.md`](../../../docs/design-docs/customer-ranking-indications-v1.md) (PRD: [`customer-ranking-indications-v1.md`](../../../docs/prd/customer-ranking-indications-v1.md)). ADRs: [`docs/adr/customer-ranking-indications/`](../../../docs/adr/customer-ranking-indications/).

## Purpose of this document

Use this file to extend **this** module without breaking its current contracts: public HTTP surface, ports, DTOs, domain invariants, persistence mapping, and wiring specific to customers.

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** when any of these change for customers: a route or response shape, a domain invariant, a port or DTO, a schema field or mapper rule, a resolved open decision, or the module layout. Global convention changes belong in [`AGENTS.md`](../../../AGENTS.md).

**Two sections, two meanings.** `Current contract` describes what the code does today. `Planned: rank and indication` describes the agreed design that is not implemented yet. When a slice of the design ships, move its rows from `Planned` into `Current contract` in the same change. Do not describe planned behaviour as current.

---

## Module status

### Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| Create customer (command) | Done | `POST /api/customer` |
| Email availability policy | Done | `CustomerPoliciesService.ensureEmailIsAvailable` |
| Mongo persistence | Done | `CustomerMongooseRepository` |
| Auth gate | Done | `authTokenMiddleware` (any authenticated employee, no `requireRoles`) |
| Composition root wiring | Done | `customers.module.ts` + `app.ts` |

### Not delivered (rank and indication)

Rank, indication, the origin and referrer checks, the HTTP status mapping, and the linkable origins read are **designed, not built**. See [Planned: rank and indication](#planned-rank-and-indication).

### Future work

Left for a later PRD. None of these is half-implemented here:

- A rank transition (Silver, Gold) and any endpoint that changes a rank
- Customer read: list, get, filter and summary by rank, "Indicou N", the customer search a friend picker needs
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
│   │   └── customer.model.spec.ts
│   ├── ports/
│   │   └── find-customer-by-email.port.ts
│   ├── errors/
│   │   └── customer.errors.ts
│   └── services/
│       ├── customer-policies.service.ts
│       └── customer-policies.service.spec.ts
│
├── application/
│   ├── dtos/
│   │   ├── create-customer.dto.ts
│   │   └── create-customer.dto.spec.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   └── create-customer.port.ts
│   │   └── outbound/
│   │       └── create-customer-repository.port.ts
│   └── usecases/
│       ├── create-customer.usecase.ts
│       └── create-customer.usecase.spec.ts
│
├── presentation/
│   └── controllers/
│       ├── create-customer.controller.ts
│       └── create-customer.controller.spec.ts
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

`Customer` has `id`, `name` (`Name`), `email` (`Email`), `phone` (`Phone` or `null`), `nif` (`Nif` or `null`), and `createdAt`. It has no password, role, or active flag. `Customer.create` builds a new customer. `Customer.reconstitute` rebuilds one from persistence.

Email is unique among customers. Emails may overlap with employees: there is no cross-collection check.

### Errors

| Error | When |
|-------|------|
| `CustomerAlreadyExistsError` | The email is already used by a customer |
| `InvalidNameError`, `InvalidEmailError`, `InvalidPhoneFormatError`, `InvalidNifError` (shared) | VO validation |

### Application: Create Customer (command)

Port: `CreateCustomerPort`. DTO: `{ name, email, phone?, nif? }` → `{ id }`.

1. `Customer.create(...)` then `.toJSON()` (VO validation happens here)
2. `CustomerPoliciesService.ensureEmailIsAvailable(email)`
3. `CreateCustomerRepositoryPort.create(snapshot)`
4. Return `{ id }`

### Presentation and HTTP

```text
authTokenMiddleware → adaptRoute
```

`app.ts` mounts the router at `/api`. Paths inside the router have no `/api` prefix.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/api/customer` | `201` `{ data: { id } }` |

`CreateCustomerController` checks `name` and `email` with `validationRequiredFields` (a falsy value is `MissingParamError`, `400`). It forwards `name`, `email`, `phone`, and `nif`. **Every other error is `serverError` (`500`) today**, including `CustomerAlreadyExistsError` and the VO errors. The planned design changes this.

Samples: `src/client/customer.http`.

### Persistence

- Model name: `Customer`
- Fields: `name`, `email` (unique index), `phone`, `nif`, `createdAt`
- `CustomerMongooseRepository` implements `CreateCustomerRepositoryPort` (`create`) and `FindCustomerByEmailPort` (`findByEmail`)
- The mapper keeps Mongoose types out of the domain. `nif` is stored as a number and read back as a string.

### Wiring (`customers.module.ts`)

Factory: `makeCustomersModule({ connection, authTokenMiddleware })`.

1. `connection.model('Customer', CustomerSchema)`
2. `CustomerMongooseRepository`
3. `CustomerPoliciesService(repository)`
4. `CreateCustomerUsecase(policies, repository)`
5. `CreateCustomerController(createCustomer)`
6. `makeCustomerRoutes({ createCustomerController, authTokenMiddleware })`

Returns `{ createCustomerController, createCustomer, router }`.

**Rule:** when adding a use case or query, wire it in this file. Do not construct the repository inside a controller or a use case.

---

## Planned: rank and indication

Source of truth: the [design doc](../../../docs/design-docs/customer-ranking-indications-v1.md). This section is a map for implementers, not a second spec. If the two disagree, the design doc wins.

### What changes

| Area | Change |
|------|--------|
| Domain | `Rank` (closed set `BRONZE`, `SILVER`, `GOLD`); `Indication` value object with two shapes; `Customer` holds `rank` and an optional `indication`; new errors |
| Application | `CreateCustomerDto.indication`; outbound ports `FindIndicationOriginPort` and `ExistsCustomerByIdPort`; `CreateCustomerUsecase` checks the origin or the referrer before writing |
| Presentation | `create-customer.request.ts`; controller validates `indication.categoryId` and maps errors to `400` / `409` / `500` |
| Persistence | `rank` (enum, required) and an embedded `indication` with `ObjectId` ids; `existsById`; duplicate key `11000` on email becomes `CustomerAlreadyExistsError` |
| Wiring | `makeCustomersModule` also receives `findIndicationOrigin`. `app.ts` builds `indications` first |

### Invariants to keep

- A customer is **born `BRONZE`**. `Customer.create` takes no `rank`. A `rank` in the body is never forwarded. No method, use case, or route changes a rank.
- An indication is **all or nothing**. An invalid one refuses the whole create. The customer is never created without the link.
- `Indication` has two shapes. Origin: `canal` or `campanha` + `originId`. Friend: `amigo` + `referrerCustomerId`. Both ids together, a missing id, or the id of the other shape is refused. Only a missing key or `null` means "not sent". Any other value, including `""`, counts as sent.
- The domain calls **no port**. The use case loads facts through a port and passes them as plain data to `Indication.ensureOriginIsLinkable(facts)` and `ensureReferrerExists(exists)`.
- `customers` does **not** import `@modules/indications/domain`. The three category codes are written again in this module on purpose ([ADR 0002](../../../docs/adr/customer-ranking-indications/0002-indication-is-an-embedded-value-object-owned-by-customers.md)).
- The adapter for `FindIndicationOriginPort` lives in `indications` ([ADR 0001](../../../docs/adr/customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md)). Do not read the `origins` collection from here.
- No Mongo transaction ([ADR 0003](../../../docs/adr/customer-ranking-indications/0003-no-transaction-on-create-customer.md)).
- Ending an origin never changes a customer already linked to it.
- The `indication` ids in the schema are plain `ObjectId`, with **no** Mongoose `ref`. Do not use `populate()` or `$lookup` into `origins`.

### Standard for reads that need another module's data

A query composes it ([ADR 0005](../../../docs/adr/customer-ranking-indications/0005-cross-module-reads-are-composed-in-the-query-through-ports.md)). It reads its own rows, collects the foreign ids, asks the owner through an outbound port that takes a batch of ids and returns a read model, and merges into its own read-model DTO. The merge is in `application/queries/`, not in the domain, and the result is a DTO, not an entity. A referrer's name comes from this module's own read port. The first user is the future customer read (not built).

### Planned HTTP mapping

| Situation | HTTP |
|-----------|------|
| Created, with or without indication | `201` `{ data: { id } }` |
| Missing `name`, `email`, or `indication.categoryId` | `400` |
| Invalid name, email, phone, nif | `400` |
| Unknown category, incoherent shape, malformed id, indication that is not an object | `400` |
| Unknown, wrong-category, or ended origin; unknown referrer | `400` |
| Email already used | `409` |
| No / invalid session | `401` |
| Unexpected | `500` |

This API has no `404`.

### Implementation order

Slices `0` to `3` of the design doc belong to this module, in this order: domain, persistence, application, HTTP. Slice `4` (linkable origins and the lookup adapter) belongs to `indications`. Slice `5` wires everything and moves the rows of this section into `Current contract`.

---

## Open decisions / known limitations

1. **Rank climb** — what moves a customer to Silver or Gold, and whether a referral counts. Owner: the domain expert. Blocks the rank-transition PRD.
2. **Customer read** — list, get, filter and summary by rank, "Indicou N", and the customer search a friend picker needs. Until it exists, the API accepts Amigo, but the frontend cannot pick a real friend. When it exists, it follows the standard above: origin names through a batch port implemented by `indications`, referrer names through the customers' own port. What it shows when a foreign id has no row is decided there.
3. **Correcting an indication after create** — not planned.
4. **Email across modules** — customer and employee emails may overlap. No cross-collection uniqueness.
5. **HTTP mapping today** — only `MissingParamError` is `400`. Everything else is `500` until the planned mapping ships.
