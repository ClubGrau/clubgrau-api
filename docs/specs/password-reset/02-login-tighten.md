# Spec: Slice 2 — Login tighten (`loginCapable` + `sessionVersion` claim)

> Existing Login command stops hardcoding `ACTIVE` and stamps the JWT.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`01-persistence-seams.md`](./01-persistence-seams.md) (`sessionVersion` exists on the document). Does **not** need slice 0.  
> Design §6 / §7.1 / §8.1.  
> Next: [`03-middleware-session-version.md`](./03-middleware-session-version.md).

## Responsibility (this spec only)

Mapper derives `loginCapable` and `sessionVersion`. `LoginUseCase` gates on the boolean. JWT encode/decode carries `sessionVersion` (legacy tokens without the claim → `0`).

| Spec | Responsibility |
|------|----------------|
| [`01`](./01-persistence-seams.md) | Schema field exists |
| **This file** | Snapshot + mapper + Login + JWT claims |
| [`03`](./03-middleware-session-version.md) | Middleware loads by id and compares |
| [`04`](./04-request-command.md) / [`05`](./05-complete-command.md) | Reset HTTP |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `AuthenticatableUser.loginCapable` + `sessionVersion` | Yes |
| `TokenPayload` = `Omit<AuthenticatableUser, 'passwordHash' \| 'loginCapable'>` | Yes |
| `mapEmployeeDocumentToAuthenticatable` derives both | Yes |
| `LoginUseCase` `if (!user \|\| !user.loginCapable)` | Yes |
| `JwtTokenAdapter` sign/verify `sessionVersion` | Yes |
| `login.usecase.spec` VACATION / INACTIVE / REMOVED | Yes |
| Middleware DB lookup | **No** |
| Password-reset routes | **No** |
| Import employees `Status` / `Employee` into auth application | **No** |

**Prompt sketch for the agent:**

> Implement slice 2 of password-reset following [`docs/specs/password-reset/02-login-tighten.md`](./02-login-tighten.md).  
> Mapper sets `loginCapable` and `sessionVersion`. `LoginUseCase` gates on `loginCapable`. JWT encode/decode carries `sessionVersion` (missing → `0`).  
> Stop hardcoding `ACTIVE`. Do not import employees `Status`. Do not add password-reset routes.

## 1. Snapshot + payload (normative)

`domain/models/authenticatable-user.model.ts`:

```ts
type AuthenticatableUser = {
  id: string
  name: string
  email: string
  passwordHash?: string
  status: string          // JWT claim only
  role: string
  loginCapable: boolean   // adapter-derived; ACTIVE | VACATION → true
  sessionVersion: number  // 0 when the schema field is missing
}
```

`domain/models/token-payload.model.ts`:

```ts
type TokenPayload = Omit<AuthenticatableUser, 'passwordHash' | 'loginCapable'>
```

Keep `status`, `role`, `sessionVersion` on the JWT. Never put `passwordHash` or `loginCapable` in the token.

## 2. Mapper (anti-corruption)

File: `employee-authenticatable.mapper.ts`.

```ts
loginCapable = status === 'ACTIVE' || status === 'VACATION'
sessionVersion = document.sessionVersion ?? 0
```

The **string literals live only in this mapper**. Login / request / complete **do not** switch on status. Do not import `EmployeeModel.Status`.

## 3. Login use case (normative)

File: `application/usecases/login.usecase.ts`. Class name today is `LoginUseCase`.

Remove `ACTIVE_STATUS`. Replace:

```ts
if (!user || user.status !== ACTIVE_STATUS)
```

with:

```ts
if (!user || !user.loginCapable) throw new AuthenticationError()
```

Then compare hash as today. `generateToken` must include `sessionVersion: user.sessionVersion`. Do not pass `passwordHash` or `loginCapable` as JWT claims — `JwtTokenAdapter` already builds `TokenPayload` explicitly; add `sessionVersion` there the same way it already omits `passwordHash`.

`AuthenticationError` message and opacity stay (`Authentication failed`).

## 4. JWT adapter (normative)

`generateToken`: signed object includes `sessionVersion` (from the user snapshot, default `0` if somehow missing).

`decode`:

```ts
sessionVersion: Number(decoded.sessionVersion ?? 0)
```

A legacy token with no claim behaves as `0` (matches stored default). Do not throw on a missing claim.

Update `jwt-token.adapter.spec.ts` fixtures and the `jwt.sign` expected payload.

## Compile seams

Fixtures that build `AuthenticatableUser` / `TokenPayload` must add:

- `loginCapable: true` (or `false` for refuse cases) on the snapshot
- `sessionVersion: 0` on snapshot **and** `TokenPayload`

Touch:

- `login.usecase.spec.ts` (default stub + INACTIVE case)
- `jwt-token.adapter.spec.ts`
- `employee-auth.adapter.spec.ts` expected `toEqual` (mapper now returns the two new fields)
- `auth-token.middleware.spec.ts` `makeTokenPayload()` — add `sessionVersion: 0` so the type compiles; behaviour of the middleware is still decode-only in this slice
- `auth.controller.spec.ts` only if it constructs a user (it does not today)

Do not rename `find-authenticable-by-email.port.ts` (existing filename typo). New ports in later slices use `authenticatable`.

## Files

| File | Action |
|------|--------|
| `domain/models/authenticatable-user.model.ts` | Add fields |
| `domain/models/token-payload.model.ts` | Omit `loginCapable` too |
| `employee-authenticatable.mapper.ts` | Derive both |
| `employee-auth.adapter.spec.ts` | Expect new fields |
| `login.usecase.ts` + `*.spec.ts` | Gate + token claim |
| `jwt-token.adapter.ts` + `*.spec.ts` | Sign/decode `sessionVersion` |
| `auth-token.middleware.spec.ts` | Fixture only |
| Routes / reset use cases / middleware I/O | Do not add |

## Spec expectations

### `employee-auth.adapter.spec.ts` / mapper

| `it(...)` | Assert |
|-----------|--------|
| ACTIVE document | `loginCapable: true`, `sessionVersion: 0` when field missing |
| document with `sessionVersion: 3` | snapshot `sessionVersion === 3` (add a case) |
| VACATION document | `loginCapable: true` (add a case) |
| INACTIVE / REMOVED document | `loginCapable: false` (one case each or `it.each`) |

The mapper can be tested through the adapter or a tiny mapper spec. Prefer extending the adapter spec so one place maps lean → snapshot.

### `login.usecase.spec.ts`

Keep existing unknown / wrong-password / port-throw cases. Change the “not active” case and add VACATION.

| `it(...)` | Assert |
|-----------|--------|
| default stub still succeeds | `loginCapable: true`, `sessionVersion: 0` on generateToken payload |
| `should throw AuthenticationError when user is not login-capable` | stub `loginCapable: false` (status may still be `INACTIVE`); compare **not** called |
| `should succeed when loginCapable is true and status is VACATION` | generateToken called; include `sessionVersion` |
| `INACTIVE` / `REMOVED` with `loginCapable: false` | same opaque `AuthenticationError` (mapper is the source of truth; use case must not read status) |
| generateToken payload | includes `sessionVersion`; does not need `loginCapable` / `passwordHash` |

Rename the old `should throw AuthenticationError when user is not active` — the use case no longer reads `ACTIVE`.

### `jwt-token.adapter.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `jwt.sign` payload includes `sessionVersion` | and still has no `passwordHash` / `loginCapable` |
| `decode` returns `sessionVersion` from the token | |
| `decode` missing `sessionVersion` | `0` |

## Checklist (agent)

- [ ] Use case gates on `loginCapable` only
- [ ] Mapper is the only place that knows `'ACTIVE' \| 'VACATION'`
- [ ] JWT has `sessionVersion`; legacy decode → `0`
- [ ] `loginCapable` never signed
- [ ] VACATION login spec exists
- [ ] No reset routes; middleware still does not hit Mongo

## Out of scope

- `findAuthenticatableById`
- Async sessionVersion compare
- `$inc` on complete
- Request / complete HTTP

## Acceptance criteria

- [ ] `POST /auth` with `VACATION` + correct password → use case returns a token (unit: generateToken called)
- [ ] `INACTIVE` / `REMOVED` / unknown → same `AuthenticationError` as today
- [ ] Signed JWT includes `sessionVersion` and excludes `passwordHash` / `loginCapable`
- [ ] Token without the claim decodes as `sessionVersion: 0`
- [ ] Login + JWT + adapter specs pass

## Reference map

| Concern | Look at |
|---------|---------|
| Login today | `login.usecase.ts` (`ACTIVE_STATUS`) |
| Mapper today | `employee-authenticatable.mapper.ts` |
| JWT today | `jwt-token.adapter.ts` |
| Design Login | design §8.1 |
| Next slice | [`03-middleware-session-version.md`](./03-middleware-session-version.md) |
