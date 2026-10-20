# Spec: Slice 3 — Create customer HTTP

> Request shape, required fields, and the status of each refusal.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md).  
> Design §10.1. PRD §3 and §7.  
> Next: [`04-linkable-origins.md`](./04-linkable-origins.md) can proceed in parallel once slice 2 exists. Wiring is [`05-wiring-and-contract.md`](./05-wiring-and-contract.md).

## Responsibility (this spec only)

Stop using the application DTO as the raw body. Validate `name`, `email`, and, when an indication object is sent, `indication.categoryId`. Map domain errors to `400` or `409`. A `rank` in the body is not forwarded.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-application.md) | Use case throws the errors mapped here |
| **This file** | Request type, controller, controller spec, `customer.http` |
| [`05`](./05-wiring-and-contract.md) | Module factory. The route gate does not change |

Paths below are under `src/modules/customers/` unless noted.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `presentation/http/create-customer.request.ts` | Yes |
| `CreateCustomerController` + spec | Yes |
| `BaseController.validationRequiredFields` first argument widened to `object` | Yes — so the nested call type-checks. Behaviour stays “falsy → field name” |
| `src/client/customer.http` | Yes |
| `customer.routes.ts` | **No** — still `authTokenMiddleware` → `adaptRoute` |
| `customers.module.ts`, `app.ts`, `AGENT.md` | **No** |
| Linkable origins | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of Customer Rank and Indication following [`docs/specs/customer-ranking-indications/03-http.md`](./03-http.md).  
> `POST /api/customer` stays `201 { data: { id } }` behind `authTokenMiddleware` only. Missing `name`, `email`, or `indication.categoryId` is `400`. Domain indication and VO errors are `400`. `CustomerAlreadyExistsError` is `409`. A `rank` in the body is ignored.  
> Do not change the route gate, the module factory, or indications.

## Request

File: `presentation/http/create-customer.request.ts`.

```ts
export type CreateCustomerRequest = {
  name: string
  email: string
  phone?: string | null
  nif?: number | null
  indication?: {
    categoryId: string
    originId?: string | null
    referrerCustomerId?: string | null
  } | null
}
```

Do not put `rank` on this type. The controller generic becomes `CreateCustomerRequest`, not `CreateCustomerDto`.

## `validationRequiredFields`

Today the method is `validationRequiredFields(request: Req, ...)`. Passing `request.indication` does not type-check, because the nested object is not a `CreateCustomerRequest`.

In `src/shared/presentation/protocols/base-controller.ts`, type the first parameter as `object` and read fields from it as `Record<string, unknown>`. A falsy value still returns that field name. Existing callers pass their request object and keep the same results. Do not add a second presence-check helper.

## Controller

File: `presentation/controllers/create-customer.controller.ts`.

`handle(request: CreateCustomerRequest)`:

1. `validationRequiredFields(request, ['name', 'email'])`. A returned field is `badRequest(new MissingParamError(field))`. Do not call the port.
2. `indication` `null` or `undefined`: the DTO indication is `null`.
3. `indication` sent but not a plain object (a string, a number, an array, or any non-object): `badRequest(new CustomerIndicationInvalidError())`. Do not call the port. `Array.isArray` is part of this check, because an array is an object in JavaScript.
4. `indication` is a plain object: `validationRequiredFields(request.indication, ['categoryId'])`. A miss is `badRequest(new MissingParamError('indication.categoryId'))`. The message field is the prefixed name, not the bare `'categoryId'` the helper returns. Do not call the port.
5. Call `execute` with `{ name, email, phone, nif, indication }`. When step 4 passed, `indication` is `{ categoryId, originId, referrerCustomerId }` copied off the object. Unknown keys on the body or inside `indication`, including `rank`, are not forwarded.
6. Success is `created({ id: result.id })`.

Error mapping, in the `catch`, same style as `CreateIndicationOriginController`:

| Error | Response |
|-------|----------|
| `InvalidNameError`, `InvalidEmailError`, `InvalidPhoneFormatError`, `InvalidNifError` | `badRequest` |
| `InvalidUniqueEntityIdError` | `badRequest` |
| `CustomerIndicationInvalidError` | `badRequest` |
| `CustomerIndicationOriginNotFoundError` | `badRequest` |
| `CustomerIndicationOriginCategoryMismatchError` | `badRequest` |
| `CustomerIndicationOriginEndedError` | `badRequest` |
| `CustomerReferrerNotFoundError` | `badRequest` |
| `CustomerAlreadyExistsError` | `conflict` |
| anything else | `serverError` |

`MissingParamError` is returned in steps 1 and 4. It is not thrown.

The route file stays:

```text
authTokenMiddleware → adaptRoute
```

No `requireRoles`. `401` stays the middleware’s job. This API has no `404`.

## `customer.http`

Extend `src/client/customer.http`. Keep the existing required-fields sample, the phone/nif sample, the missing-email sample, and the unauthenticated sample.

Add:

- Create with a channel indication: `indication: { categoryId: "canal", originId: "<24-hex>" }`. Comment: `201`, stored rank is Bronze.
- Create with a friend indication: `indication: { categoryId: "amigo", referrerCustomerId: "<24-hex>" }`.
- Create with `indication: null`. Comment: walk-in, `201`, no link.
- Create with `"rank": "GOLD"` plus name and email. Comment: ignored, stored rank is Bronze.
- `indication` as a string. Comment: `400`.
- `indication: {}` or `indication` without `categoryId`. Comment: `400`, field `indication.categoryId`.
- Comment, not necessarily a separate request for every one: unknown category, ended origin, unknown referrer, and duplicate email are `400` except duplicate email, which is `409`.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/customers/presentation/http/create-customer.request.ts` |
| Edit | `src/modules/customers/presentation/controllers/create-customer.controller.ts` |
| Edit | `src/modules/customers/presentation/controllers/create-customer.controller.spec.ts` |
| Edit | `src/shared/presentation/protocols/base-controller.ts` |
| Edit | `src/client/customer.http` |

## Spec expectations

The controller spec stubs `CreateCustomerPort`. Switch request values to `CreateCustomerRequest`.

Keep: missing `name` → `400` `MissingParamError('name')`; missing `email` → `400`; success → `201` `{ data: { id } }`; an unexpected `Error` → `500`.

Update the “called with” cases: a body without `indication` is forwarded as `indication: null` (plus `phone` and `nif` as today, `undefined` when omitted).

- `indication: null` forwards `indication: null` and returns `201`.
- A plain indication object forwards only `categoryId`, `originId`, and `referrerCustomerId`. An extra key inside `indication` is not forwarded.
- A body that also has `rank: 'GOLD'` (cast the request if the type omits it) calls `execute` without `rank`, and the call still has no rank field.
- `indication: 'instagram'`, `indication: 1`, and `indication: []` return `400` with `CustomerIndicationInvalidError`'s message, and `execute` is not called.
- `indication: {}` or `{ originId: '<hex>' }` without `categoryId` returns `400` `MissingParamError('indication.categoryId')`, and `execute` is not called.
- `execute` rejecting `InvalidNameError`, `InvalidEmailError`, `InvalidPhoneFormatError`, `InvalidNifError`, `InvalidUniqueEntityIdError`, or any of the five customer indication errors returns `400`.
- `execute` rejecting `CustomerAlreadyExistsError` returns `409` with message `Customer already exists`.
- `execute` is not called when `name` or `email` is missing.

## Acceptance criteria

- [ ] Created, with or without an indication, is `201` `{ data: { id } }`.
- [ ] Missing `name`, `email`, or `indication.categoryId` is `400` and does not call the port.
- [ ] An indication that is not a plain object is `400`.
- [ ] Invalid name, email, phone, nif, indication shape, malformed id, unknown origin, wrong category, ended origin, and unknown referrer are `400`.
- [ ] A taken email is `409`.
- [ ] An unexpected error is `500`.
- [ ] `rank` is not forwarded.
- [ ] The route is still any authenticated employee.

## Out of scope

- Wiring `findIndicationOrigin` into `makeCustomersModule`.
- The linkable-origins route.
- `401` handling inside the controller.

## Checklist

- [ ] The controller request type is `CreateCustomerRequest`.
- [ ] `validationRequiredFields` is used for `name`, `email`, and `indication.categoryId`.
- [ ] The `categoryId` miss is reported as `indication.categoryId`.
- [ ] The error table in section Controller is implemented with `instanceof`.
- [ ] `customer.http` has the origin, friend, walk-in, and ignored-rank samples.
- [ ] `customer.routes.ts` and `customers.module.ts` are unchanged.
