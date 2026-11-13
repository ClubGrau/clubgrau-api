# Spec: Slice 5 — Wiring and contract

> Compose the slices and update the living contracts.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md), [`03-auth.md`](./03-auth.md), [`04-http.md`](./04-http.md).  
> Design §12.

## Responsibility (this spec only)

Factories and `app.ts`, then the two `AGENT.md` files. No new behaviour.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `auth.module.ts` returns `verifyActorPassword` | Yes |
| `customers.module.ts` builds the remove use case and controller | Yes |
| `app.ts` passes the new deps | Yes |
| `customers/AGENT.md`, `auth/AGENT.md` | Yes |
| Any new logic | **No** |

**Prompt sketch for the agent:**

> Implement slice 5 of Remove Customer following [`docs/specs/remove-customer/05-wiring-and-contract.md`](./05-wiring-and-contract.md).  
> Wire `ActorPasswordVerifierAdapter` in `makeAuthModule`, `RemoveCustomerUsecase` and its controller in `makeCustomersModule`, pass `makeRequireRoles` and `verifyActorPassword` from `app.ts`, then update both AGENT.md files.

## `auth.module.ts`

- Build `new ActorPasswordVerifierAdapter(employeeAuthAdapter, compareHash)`.
- Add `verifyActorPassword: VerifyActorPasswordPort` to `AuthModule` and return it.

## `customers.module.ts`

```ts
type CustomersModuleDeps = {
  connection: Connection
  authTokenMiddleware: RequestHandler
  makeRequireRoles: (...roles: string[]) => RequestHandler
  findIndicationOrigin: FindIndicationOriginPort
  findIndicationOriginNamesByIds: FindIndicationOriginNamesByIdsPort
  verifyActorPassword: VerifyActorPasswordPort
}
```

1. Same single `CustomerMongooseRepository`. Do not build a second one.
2. `CreateCustomerUsecase(customerPoliciesService, findIndicationOrigin, customerRepository /* ExistsReferrableCustomerByIdPort */, customerRepository)`.
3. `GetCustomersQuery` unchanged in arguments.
4. `const removeCustomer: RemoveCustomerPort = new RemoveCustomerUsecase(verifyActorPassword, customerRepository /* FindCustomerByIdPort */, customerRepository /* RemoveCustomerRepositoryPort */)`.
5. `const removeCustomerController = new RemoveCustomerController(removeCustomer)`.
6. `makeCustomerRoutes({ createCustomerController, getCustomersController, removeCustomerController, authTokenMiddleware, makeRequireRoles })`.
7. Return `removeCustomerController` and `removeCustomer` in `CustomersModule`.

## `app.ts`

```ts
const customers = makeCustomersModule({
  connection,
  authTokenMiddleware: auth.authTokenMiddleware,
  makeRequireRoles: auth.makeRequireRoles,
  findIndicationOrigin: indications.findIndicationOrigin,
  findIndicationOriginNamesByIds: indications.findIndicationOriginNamesByIds,
  verifyActorPassword: auth.verifyActorPassword,
})
```

Build order is unchanged: auth, employees, indications, customers.

## `customers/AGENT.md`

Update the current contract (not a changelog):

- Header: link PRD, design, specs, and ADRs of remove-customer.
- Delivered: remove customer (command) — `POST /api/customer/remove`.
- Future work: drop "delete a customer"; keep update and inactivity (computed, owned by domain experts).
- Domain model: `removedAt`, `isRemoved`, `remove(now)`; what is kept and what is erased.
- Errors table: the three new errors.
- Application: Remove Customer flow; create uses `ExistsReferrableCustomerByIdPort`; list filters removed and adds `referrerRemoved`.
- HTTP: the route with `requireRoles('ADMIN', 'MANAGER')` and its status table.
- Persistence: `removedAt` field; the new repository methods and the filters.
- Wiring: new deps and constructor order.
- Directory map: new files.
- Open decisions: sale name copy; GDPR shortening of the kept name.

## `auth/AGENT.md`

Add `ActorPasswordVerifierAdapter` (implements `customers`' `VerifyActorPasswordPort`) and `verifyActorPassword` in the module return, next to `ReissueOwnSessionTokenAdapter`.

## Files

| Action | Path |
|--------|------|
| Edit | `src/modules/auth/auth.module.ts` |
| Edit | `src/modules/customers/customers.module.ts` |
| Edit | `src/app.ts` |
| Edit | `src/modules/customers/AGENT.md` |
| Edit | `src/modules/auth/AGENT.md` |

## Done-check

- [ ] `tsc` passes.
- [ ] The full Jest suite passes.
- [ ] Manual run of `src/client/customer.http`: remove ok (`200`), missing password (`400`), wrong password (`401`), EMPLOYEE (`403`), second remove (`409`), unknown id (`400`), list without the removed customer, Friend indication with `referrerRemoved: true`, create with `amigo` pointing at it (`400`), create with the freed email (`201`).

## Out of scope

- Any behaviour not in slices 0 to 4.
- `CONTEXT.md` (already updated with the design).
