# Spec: Slice 4 — Remove customer HTTP

> `POST /api/customer/remove` for ADMIN and MANAGER.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md) (`RemoveCustomerPort` and the errors from slice 0).  
> Design §10 / [ADR 0005](../../adr/remove-customer/0005-admin-and-manager-may-remove-a-customer.md).  
> Next: [`05-wiring-and-contract.md`](./05-wiring-and-contract.md).

## Responsibility (this spec only)

Request shape, controller with its error map, and the route. The controller is Express-free.

Paths below are under `src/modules/customers/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `presentation/http/remove-customer.request.ts` | Yes |
| `RemoveCustomerController` + spec | Yes |
| Route in `customer.routes.ts` with `requireRoles` | Yes |
| `src/client/customer.http` samples | Yes |
| `customers.module.ts`, `app.ts` | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of Remove Customer following [`docs/specs/remove-customer/04-http.md`](./04-http.md).  
> Add `RemoveCustomerController` (required `id` and `password`, error map 400/401/409/500) and `POST /customer/remove` behind `authTokenMiddleware` and `requireRoles('ADMIN', 'MANAGER')`. Do not edit the module factory.

## Request

File: `presentation/http/remove-customer.request.ts`.

```ts
export interface RemoveCustomerRequest {
  id?: unknown
  password?: unknown
  actorId?: string
}
```

`actorId` is stamped by `adaptRoute` from the JWT and overwrites any body value.

## Controller

File: `presentation/controllers/remove-customer.controller.ts`. Mirrors `RemoveEmployeeController`.

1. `const missingField = this.validationRequiredFields(request, ['id', 'password'])`; a miss → `badRequest(new MissingParamError(missingField))`. The port is not called.
2. `execute({ actorId: String(request.actorId ?? ''), customerId: String(request.id), actorPassword: String(request.password) })`.
3. Success → `ok({ id })`.

| Error | Response |
|-------|----------|
| `CustomerActorAuthenticationFailedError` | `unauthorized` (`401`) |
| `CustomerAlreadyRemovedError` | `conflict` (`409`) |
| `CustomerNotFoundError` | `badRequest` (`400`) |
| anything else | `serverError` (`500`) |

`403` comes from `requireRoles`, not from the controller.

## Route

File: `infrastructure/inbound/http/customer.routes.ts`.

```ts
export type CustomerRoutesDependencies = {
  createCustomerController: CreateCustomerController
  getCustomersController: GetCustomersController
  removeCustomerController: RemoveCustomerController
  authTokenMiddleware: RequestHandler
  makeRequireRoles: (...roles: string[]) => RequestHandler
}

router.post(
  '/customer/remove',
  authTokenMiddleware,
  makeRequireRoles('ADMIN', 'MANAGER'),
  adaptRoute(removeCustomerController),
)
```

Create and list keep `authTokenMiddleware` only.

## Client samples

File: `src/client/customer.http`. Add: remove ok; missing `password`; wrong password; unknown id; remove twice (`409`); create with `amigo` pointing at a removed customer (`400`); list after remove.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/customers/presentation/http/remove-customer.request.ts` |
| Create | `src/modules/customers/presentation/controllers/remove-customer.controller.ts` |
| Create | `src/modules/customers/presentation/controllers/remove-customer.controller.spec.ts` |
| Edit | `src/modules/customers/infrastructure/inbound/http/customer.routes.ts` |
| Edit | `src/client/customer.http` |

## Spec expectations

`remove-customer.controller.spec.ts` (stub `RemoveCustomerPort`):

- Missing `id` → `400` `MissingParamError('id')`; port not called.
- Missing `password` → `400` `MissingParamError('password')`; port not called.
- Valid request → port called with `{ actorId, customerId: id, actorPassword: password }`; `200` `{ data: { id } }`.
- Missing `actorId` → port called with `actorId: ''` (the use case refuses it).
- Port throws `CustomerActorAuthenticationFailedError` → `401`.
- `CustomerAlreadyRemovedError` → `409`.
- `CustomerNotFoundError` → `400`.
- Any other error → `500`.

## Acceptance criteria

- [ ] Required fields go through `validationRequiredFields`.
- [ ] The controller imports nothing from Express.
- [ ] Only the remove route has `requireRoles('ADMIN', 'MANAGER')`.

## Out of scope

- Passing `makeRequireRoles` and the controller into the routes from the module (slice 5).

## Checklist

- [ ] Request type in `presentation/http`.
- [ ] Error map matches the table.
- [ ] Route path is `/customer/remove`.
- [ ] `.http` samples added.
