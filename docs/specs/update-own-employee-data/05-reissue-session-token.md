# Spec: Slice 5 — Reissue Session Token after `name`

> Auth issues a new Session Token when Update Own Employee Data succeeds and the body included `name`.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`04-http-and-contract.md`](./04-http-and-contract.md).  
> Design §4 (Session Token after `name`) / §9.2 / §11 / §12.  
> ADR: [`0001`](../../adr/update-own-employee-data/0001-reissue-session-token-on-name-change.md).  
> Jira: TBD.  
> Next: none.

## Responsibility (this spec only)

Ship the reissue. Slice 4 already returns `{ data }` and does not issue a token. This slice adds `token` beside `data` only for a successful PATCH whose DTO included `name`.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-usecase.md) | `UpdateOwnEmployeeDataUsecase` still returns `GetEmployeesItemDto` only |
| [`04`](./04-http-and-contract.md) | Routes, presence, clear rules, `{ data }` |
| **This file** | Auth use case, employees port, controller branch, `app.ts` wiring |

## When to use this spec

The employees use case does not generate a JWT. Auth does, with the same `generateToken` as Login. `sessionVersion` is not incremented. There is no new route and no password check.

| Artifact | This slice? |
|----------|-------------|
| `ReissueSessionTokenUseCase` + inbound port + spec | Yes — auth |
| `ReissueOwnSessionTokenPort` | Yes — employees outbound port (interface only) |
| `UpdateOwnEmployeeDataController` calls the port after `execute` when `name` was in the DTO | Yes |
| `app.ts` passes Auth `reissueOwnSessionToken` into employees | Yes |
| `employee.http` comment on the name sample | Yes |
| Living `AGENT.md` (employees + auth) and auth `CONTEXT.md` if the glossary line is still the old one | Yes |
| New HTTP route | **No** |
| `sessionVersion` increment | **No** |
| Refresh Token / `remember` | **No** |
| Changing `UpdateOwnEmployeeDataUsecase` return type | **No** |
| Employees importing Auth domain | **No** |

**Prompt sketch for the agent:**

> Implement slice 5 of Update Own Employee Data following [`docs/specs/update-own-employee-data/05-reissue-session-token.md`](./05-reissue-session-token.md).  
> Auth `ReissueSessionTokenUseCase` loads the authenticatable and calls `generateToken` with live claims and the same `sessionVersion`. No password check. No `$inc`.  
> The Profile Card controller returns `{ data, token }` only when the successful DTO included `name`. `app.ts` injects Auth `reissueOwnSessionToken`. Do not import Auth domain from the employees hexagon. Do not add a route.

## Auth command

`ReissueSessionTokenUseCase` in the auth hexagon. Inbound port `ReissueSessionTokenPort`. Output is the existing `LoginResultDto` (`{ token }`). Input:

```ts
type ReissueSessionTokenDto = {
  actorId: string;
};
```

Flow:

1. `actorId` empty or blank → `AuthenticationError`.
2. `findAuthenticatableById(actorId)` → `null` or `!loginCapable` → `AuthenticationError`.
3. `generateToken` with `{ id, name, email, role, status, sessionVersion }` from that user. Do not copy claims off the incoming JWT. Do not pass `passwordHash` or `loginCapable`.
4. Return `{ token }`.

Do not call `CompareHashPort`. Do not call `updateCredentials`. Do not `$inc sessionVersion`. Do not add a controller or a route. Login stays `POST /auth`.

## Employees port

```ts
export interface ReissueOwnSessionTokenPort {
  execute(actorId: string): Promise<{ token: string }>;
}
```

Declared under employees `application/ports/outbound/`. No adapter class inside the employees hexagon. Auth implements the port with `ReissueOwnSessionTokenAdapter`, wired in `auth.module.ts`. `app.ts` passes `auth.reissueOwnSessionToken` and supplies `makeActorAuthenticationFailedError` as `reissueAuthenticationFailedError`.

The adapter maps Auth `AuthenticationError` to `ActorAuthenticationFailedError` before it reaches the employees controller. Any other throw stays an unexpected error. `makeEmployeesModule` receives `reissueOwnSessionToken: ReissueOwnSessionTokenPort` and passes it into `UpdateOwnEmployeeDataController`.

The employees tree does not import `@modules/auth`. Auth does not import the employees domain error; the composition root passes the factory.

## Controller

After `updateOwnEmployeeData.execute` resolves:

| DTO | Response |
|-----|----------|
| `name` not in the DTO | `ok(readModel)` — body `{ data }`, no `token` key |
| `name` in the DTO | `reissueOwnSessionToken.execute(actorId)` then `200` `{ data: readModel, token }` |

`name` in the DTO means the key was forwarded to the use case, including when the stored name is unchanged. Same-name retry is how a failed reissue is finished. The write is already committed.

Reissue `ActorAuthenticationFailedError` → `401`. Any other reissue throw → `500`. Do not roll back `updateOwnData`. GET is unchanged. A PATCH that omitted `name` does not call the port.

`ok()` stays for the no-token path. The token path is a `200` whose body is `{ data, token }` (`token` is a sibling of `data`, not a field of the read model).

## Failure after the write

The `$set` is not undone. `401` / `500` from reissue means the name may already be stored. The next PATCH that includes `name` reissues again.

## `.http` and contracts

In `src/client/employee.http`, on the sample that sends `name`, comment that `200` is `{ data, token }`, the Front replaces the stored Session Token, and `sessionVersion` does not change. Phone-only, username clear, and `nif: null` samples stay `{ data }` only.

Employees `AGENT.md`:

- HTTP: successful PATCH with `name` → `{ data, token }`; otherwise `{ data }`; GET has no `token`.
- Wiring list: controller receives `ReissueOwnSessionTokenPort`.
- Open decision 17 becomes shipped: reissue on `name`, same `sessionVersion`, previous token still valid until expiry. Point at ADR 0001.

Auth `AGENT.md`:

- Delivered: Reissue Session Token (no route; called from the Profile Card wiring).
- Directory map: use case, inbound port, dto.
- Open decisions: this does not add a Refresh Token and does not increment `sessionVersion`.

Auth `CONTEXT.md` **Session Token**: issued by Login and reissued after a successful Update Own Employee Data that included `name`. Same `sessionVersion`. Not a Refresh Token.

Employees `CONTEXT.md` **Update Own Employee Data**: one sentence that a successful save which includes `name` reissues the Session Token. Avoid: refresh token, `remember`.

## Files

| File | Action |
|------|--------|
| `src/modules/auth/application/dtos/reissue-session-token.dto.ts` | Create input; reuse `LoginResultDto` as output |
| `src/modules/auth/application/ports/inbound/reissue-session-token.port.ts` | Create |
| `src/modules/auth/application/usecases/reissue-session-token.usecase.ts` + `*.spec.ts` | Create |
| `src/modules/auth/auth.module.ts` | Construct the use case and `ReissueOwnSessionTokenAdapter`; return `reissueOwnSessionToken` |
| `src/modules/employees/application/ports/outbound/reissue-own-session-token.port.ts` | Create |
| `presentation/controllers/update-own-employee-data.controller.ts` + spec | Call the port; extend the success body |
| `src/modules/auth/infrastructure/outbound/reissue-own-session-token.adapter.ts` + spec | Create; map `AuthenticationError` |
| `employees.module.ts` | Accept the port; pass it to the controller; export `makeActorAuthenticationFailedError` |
| `src/app.ts` | Pass `auth.reissueOwnSessionToken` and the employees failure factory |
| `src/client/employee.http` | Comment on the `name` sample |
| `employees/AGENT.md`, `auth/AGENT.md`, both `CONTEXT.md` | Living contract |

## Spec expectations

### `reissue-session-token.usecase.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| blank `actorId` | `AuthenticationError`; finder not called; `generateToken` not called |
| finder returns `null` | `AuthenticationError`; `generateToken` not called |
| `loginCapable: false` | `AuthenticationError`; `generateToken` not called |
| login-capable user | `generateToken` with that user's `id`, `name`, `email`, `role`, `status`, `sessionVersion` |
| success | `{ token }` from the provider |
| no password compare, no credentials update | those ports are not constructor deps |

### `update-own-employee-data.controller.spec.ts` (extend)

| `it(...)` | Assert |
|-----------|--------|
| `{ phone }` success | reissue port not called; `200` `{ data }`; no `token` key |
| `{ name: 'João Silva' }` success | reissue port `{ actorId }` from the stamped id; `200` `{ data, token }`; `data` is the read model; `token` is not inside `data` |
| `{ name, phone }` success | reissue port called once |
| `{ name }` and reissue throws `ActorAuthenticationFailedError` | `401`; the own-data port was already called |
| `{ name }` and reissue throws a generic `Error` | `500` |
| `{}` / blank `name` | still `400` before `execute`; reissue port not called |

## Checklist (agent)

- [ ] Use case signs live claims and the stored `sessionVersion`
- [ ] No password check, no `$inc`, no new route
- [ ] Employees use case return type unchanged
- [ ] Controller calls reissue only after `execute` resolves and only when `name` was in the DTO
- [ ] `{ data, token }` on that path; `{ data }` otherwise; GET unchanged
- [ ] `ReissueOwnSessionTokenAdapter` maps `AuthenticationError` → `ActorAuthenticationFailedError`
- [ ] Employees sources do not import Auth domain
- [ ] `employee.http` comments the `name` sample
- [ ] Both `AGENT.md` files and both glossaries match ADR 0001
- [ ] Co-located specs pass

## Out of scope

- Refresh Token and `remember` on Login
- Revoking the previous Session Token
- Reissue on email, role, or status change
- A public reissue route
- Rolling back `updateOwnData` when reissue fails
- `adaptRoute` stamping `actorName`

## Acceptance criteria

- [ ] Login-capable Actor + `PATCH` `{ "name": "Ana" }` → `200` `{ data, token }`. `data.name` is `Ana`. Decoding `token` yields `name: Ana` and the same `sessionVersion` as the token that called the route
- [ ] The previous token still passes `authTokenMiddleware` until it expires
- [ ] `PATCH` `{ "phone": "+351 912 345 678" }` → `200` `{ data }` and no `token`
- [ ] `PATCH` `{ "name": "Ana" }` when the stored name is already `Ana` → still `200` `{ data, token }`
- [ ] `PATCH` `{ "name": "" }` → `400` before `execute`; no write; no token
- [ ] Reissue finder miss after a successful write → `401`; the new name stays stored
- [ ] GET `/api/employee/me` → `200` `{ data }` and no `token`
- [ ] `POST /auth` is unchanged

## Reference map

| Concern | Look at |
|---------|---------|
| Login `generateToken` claims | `src/modules/auth/application/usecases/login.usecase.ts` |
| `LoginResultDto` | `src/modules/auth/application/dtos/login.dto.ts` |
| `AuthenticationError` | `src/modules/auth/domain/errors/auth.errors.ts` |
| Middleware `sessionVersion` check | `src/modules/auth/infrastructure/inbound/http/auth-token.middleware.ts` |
| Profile Card controller | `presentation/controllers/update-own-employee-data.controller.ts` |
| Composition root | `src/app.ts` |
| ADR | `docs/adr/update-own-employee-data/0001-reissue-session-token-on-name-change.md` |
