# Spec: Create Customer (Part 1)

> Feature contract before implementation.  
> Global rules: [`AGENTS.md`](../../AGENTS.md).  
> Reference hexagon: [`src/modules/employees`](../../src/modules/employees) (structure only — domain differs).

## Goal

Allow an **authenticated employee** to register a **Customer** managed by staff.

Customers will have a future journey in the system, but **Part 1 is create-only**. Customers do **not** authenticate, do **not** have passwords, and are **not** part of the auth login flow in this phase.

## Actors

| Actor | Role in Part 1 |
|-------|----------------|
| Employee (authenticated) | Calls `POST /api/customer` |
| Customer | Domain entity being created (no self-signup) |

## HTTP surface

| Item | Contract |
|------|----------|
| Method / path | `POST /api/customer` |
| Auth | Required — `authTokenMiddleware` (same pattern as employee routes) |
| Success | `201` + `{ id: string }` (via existing `created(...)` / `{ data: { id } }` response shape) |
| Missing required body fields | `400` + `MissingParamError` (controller) |

Manual samples (after impl): `src/client/customer.http`.

## Domain model (Part 1)

### Fields

| Field | Type | Required on create | Notes |
|-------|------|--------------------|-------|
| `id` | `UniqueEntityId` | generated | Same pattern as Employee |
| `name` | `Name` VO | yes | Shared `@shared/domain` |
| `email` | `Email` VO | yes | Shared; **unique** among customers |
| `phone` | `Phone` VO \| `null` | no | Shared VO (`@shared/domain`); omit/`null` allowed. Create via [`create-value-object.md`](./create-value-object.md) + [Phone fill-in](#phone-vo-fill-in); wire via [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md) |
| `nif` | `Nif` VO \| `null` | no | Shared; omit/`null` allowed |
| `createdAt` | `Date` | default `now` | Set on create; no deactivate / `isActive` in this module |

### Explicitly out of this entity (Part 1)

- `password` / password confirmation / hashing  
- `role`  
- `isActive` / `deactivateAt` / activate-deactivate flows  
- Auth / JWT / login as customer  

### Factory sketch

```ts
Customer.create({ name, email, phone?, nif? })
// → validates VOs, defaults createdAt = now, phone/nif null when absent

Customer.reconstitute({ id, name, email, phone, nif, createdAt })
// → rebuild from persistence
```

## Business rules

| Rule | Behavior |
|------|----------|
| Email uniqueness | Before persist, ensure no customer already exists with the same email. If found → domain error (e.g. `CustomerAlreadyExistsError`) |
| VO validation | Invalid name/email/phone/nif → existing / new VO errors (same style as shared VOs) |

No inactive-email collision, reactivation, or password policies for Customer.

## Application contract

### Inbound

```ts
interface CreateCustomerPort {
  execute(params: CreateCustomerDto): Promise<CreateCustomerResultDto>;
}
```

### DTOs

```ts
interface CreateCustomerDto {
  name: string;
  email: string;
  phone?: string | null;
  nif?: number | null;
}

interface CreateCustomerResultDto {
  id: string;
}
```

### Outbound (minimum)

```ts
interface CreateCustomerRepositoryPort {
  create(customer: CustomerModel.toCreate): Promise<CreateCustomerResultDto>;
}

// Domain policy / uniqueness (same idea as FindEmployeeByEmailPort)
interface FindCustomerByEmailPort {
  findByEmail(email: string): Promise<CustomerModel.toCreate | null>;
}
```

Exact snapshot type name (`CustomerModel.toCreate` or equivalent) follows employees naming conventions in [`AGENTS.md`](../../AGENTS.md).

### Use case flow

1. `Customer.create(...)` → `.toJSON()` (VO validation here)  
2. Ensure email available via policy + `FindCustomerByEmailPort`  
3. Persist via `CreateCustomerRepositoryPort.create`  
4. Return `{ id }`  

No encrypter. No role checks.

## Presentation

`CreateCustomerController` extends `BaseController`:

- Required fields: `name`, `email`  
- Optional: `phone`, `nif` (forward when present)  
- Success → `201` + `{ id }`  
- Unexpected errors → `serverError(...)` (same granularity as create employee for now)

## Infrastructure

- Own collection/schema for customers (do **not** reuse Employee schema).  
- Unique index on `email`.  
- Mapper: document `_id` ↔ string `id`; `nif` number ↔ string/null as in employees; `phone` string/null.  
- Repository implements create + findByEmail.  
- Routes: `POST /customer` + `authTokenMiddleware` + `adaptRoute`.  
- Wiring: `makeCustomersModule` + mount on `/api` in `app.ts`.

## Shared work required

Follow the VO track — do **not** restate the VO implementation shape here:

| Step | Spec | Action |
|------|------|--------|
| 1 | [`create-value-object.md`](./create-value-object.md) | Create `Phone` under `@shared/domain` using the [Phone fill-in](#phone-vo-fill-in) below |
| 2 | [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md) | Wire `Phone` into `Customer` (optional field → `Phone \| null`) |

### Phone VO fill-in

> Product rules for step 1. Implementation shape, file layout, barrel export, and `*.vo.spec.ts` expectations → [`create-value-object.md`](./create-value-object.md).

| Field | Value |
|-------|-------|
| Class name | `Phone` |
| Folder / file | `src/shared/domain/value-object/phone/phone.vo.ts` |
| Scope | `@shared/domain` |
| Primitive input type | `string` |
| Error class | `InvalidPhoneFormatError` |
| Normalization | digits-only after strip (`/\D/g`); store normalized digits |
| Extra methods? | none |

**Product intent:** the frontend lets the employee pick the customer’s country (various European countries, not Portugal-only). The API receives a phone **string** (typically including country calling code). The VO must accept multi-country European numbers without hard-coding a single national format.

**Invariants:**

1. Reject `null` / `undefined` when `Phone.create` is called (optional field is handled by the entity: omit → `null`, do not call `create`).
2. After trim, reject empty / whitespace-only → `InvalidPhoneFormatError`.
3. Strip all non-digit characters (`/\D/g`) for length checks — spaces, dashes, parentheses, and a leading `+` are allowed in the input.
4. Digit count must be **between 7 and 15 inclusive** (practical E.164 bounds). Outside that range → `InvalidPhoneFormatError`.
5. No country-specific regex in Part 1 (no PT-only / BR-only masks). Country selection stays on the frontend; the backend validates international digit length.

**Examples (illustrative):**

| Input | Digits | Result |
|-------|--------|--------|
| `+351 912 345 678` | 12 | OK |
| `+33 6 12 34 56 78` | 11 | OK |
| `912345678` | 9 | OK |
| `   ` | 0 | Error |
| `123` | 3 | Error (too short) |
| 16+ digits | ≥16 | Error (too long) |

**Out of Phone VO scope:** validating that the country calling code matches the country picked in the UI; SMS/WhatsApp reachability; uniqueness of phone.

## Out of scope (Part 1)

- List customers  
- Get customer by id  
- Update customer  
- Deactivate / soft-delete / `isActive`  
- Customer login / password / auth adapters for Customer  
- Self-signup (public create without employee token)  
- Cross-collection email uniqueness with Employee (emails may overlap across modules unless product says otherwise later)

### Deferred (explicitly planned later)

- List customers  
- Get customer by id  

(No deactivate in the foreseeable roadmap for this module.)

## Differences vs Create Employee (do not copy blindly)

| Concern | Employee | Customer (Part 1) |
|---------|----------|-------------------|
| Created by | Authenticated employee | Authenticated employee |
| Password / encrypter | Yes | No |
| Role | Yes | No |
| Active / deactivate | Yes | No |
| Phone | TODO / not in entity | First-class optional VO |
| Uniqueness | Email + inactive rules | Email only |
| Auth subject | Yes (login) | No |

## Acceptance criteria

- [ ] `POST /api/customer` with valid Bearer token and `{ name, email }` → `201` + `{ id }`  
- [ ] Optional `phone` and `nif` accepted and persisted when provided  
- [ ] Invalid phone (whitespace-only, or digit count outside 7–15 after strip) → `InvalidPhoneFormatError`  
- [ ] Duplicate customer email → domain error (not silent overwrite)  
- [ ] Missing `name` or `email` → `400`  
- [ ] Unauthenticated request rejected by auth middleware  
- [ ] Hexagon layout matches [`AGENTS.md`](../../AGENTS.md) playbook (domain → application → presentation → infrastructure → module → `.http`)  
- [ ] Unit specs co-located for new domain/application/presentation/persistence pieces and for `Phone` VO  
- [ ] No password fields in schema, DTOs, or HTTP body  

## Open decisions

1. ~~**`Phone` validation rules**~~ — **Closed.** See [Phone VO fill-in](#phone-vo-fill-in) + [`create-value-object.md`](./create-value-object.md) (7–15 digits after stripping non-digits; multi-country Europe via frontend country picker; no national mask on API).  
2. **HTTP mapping of domain errors** — Keep coarse `serverError` like create employee, or map `CustomerAlreadyExistsError` / `InvalidPhoneFormatError` to `409`/`400` later. Not blocking Part 1.  
3. **NIF on HTTP** — Forward `nif` from body in the controller (unlike the known gap on create employee). Prefer forwarding for Customer from day one.

## Implementation order (when coding)

1. Shared `Phone` VO + `*.vo.spec.ts` via [`create-value-object.md`](./create-value-object.md) + [Phone fill-in](#phone-vo-fill-in)  
2. Customer domain: apply `Phone` (and other VOs) via [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md); model, errors, email policy + specs  
3. DTOs + ports  
4. Use case + spec  
5. Controller + spec  
6. Schema, mapper, repository + spec  
7. Routes + `customers.module.ts` + `app.ts`  
8. `src/client/customer.http`  
9. After Part 1 stabilizes: `src/modules/customers/AGENT.md` (living contract only)
