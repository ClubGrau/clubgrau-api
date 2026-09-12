# Spec: Slice 5 — `CompletePasswordReset` (command)

> Unauthenticated complete: raw token + new password → new hash; no Session Token.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`01`](./01-persistence-seams.md), [`02`](./02-login-tighten.md), [`03`](./03-middleware-session-version.md) (so “old JWT dies” is testable).  
> Design §8.3 / §9 / §13.  
> Next: [`06-contract.md`](./06-contract.md).

## Responsibility (this spec only)

Ship `POST /auth/password-reset/complete`: DTO → use case → controller → route → write adapter (`$set` password + `$inc sessionVersion`) → delete Reset Token row. Policy failures do **not** consume the token. Not login-capable **does** delete, then the same invalid-link `400`.

| Spec | Responsibility |
|------|----------------|
| [`01`](./01-persistence-seams.md) | Token repo + hasher |
| [`03`](./03-middleware-session-version.md) | Old JWT fails after `$inc` |
| **This file** | Complete vertical slice |
| [`06`](./06-contract.md) | `.http` + `AGENT.md` |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| DTO + inbound port + replace-password outbound port | Yes |
| `CompletePasswordResetUsecase` + spec | Yes |
| Auth-owned `PasswordNotMatchError` + `InvalidResetTokenError` | Yes |
| Controller + spec + request type | Yes |
| `POST /password-reset/complete` (unauthenticated) | Yes |
| `EmployeeAuthAdapter` `$set` password + `$inc sessionVersion` | Yes |
| `makeAuthModule` receives `encrypter` (`BcryptAdapter`) | Yes |
| Generate-password HTTP / auto-login / JWT in the response | **No** |
| Deactivate / Remove JWT status re-check | **No** |

**Prompt sketch for the agent:**

> Implement slice 5 of password-reset following [`docs/specs/password-reset/05-complete-command.md`](./05-complete-command.md).  
> Add `CompletePasswordResetUsecase`: `Password.create` + auth-owned mismatch error; HMAC lookup; replace hash + `$inc sessionVersion`; delete row. No JWT in the response.  
> Policy failures do not delete the token. Not login-capable deletes then `400` same invalid-link message. After success, a slice-3 middleware check must `401` the old JWT.

## HTTP surface

```http
POST /auth/password-reset/complete
Content-Type: application/json

{
  "token": "<raw Reset Token from the link>",
  "password": "<new password>",
  "passwordConfirmation": "<same>"
}
```

Unauthenticated. Do not run `authTokenMiddleware`.

| Result | Status | Body |
|--------|--------|------|
| Success | `200` | `{ data: { id } }` — **no** `token` |
| Missing `token` / `password` / `passwordConfirmation` | `400` | `{ error }` |
| Mismatch / `Password.create` | `400` | `{ error }` (Create-equivalent messages) |
| Invalid / expired / consumed / not login-capable | `400` | `{ error }` **one** message |
| Unexpected | `500` | `{ error }` |

No `401` on this route (there is no Session Token). No `403` / `409`.

**Do not** copy Create’s coarse `serverError` for VO/mismatch — map those classes to `badRequest`.

## Domain errors (auth-owned)

Add to `domain/errors/auth.errors.ts` (or sibling files). Do **not** import `employees/domain`.

| Class | Message | HTTP |
|-------|---------|------|
| `PasswordNotMatchError` | `Password and passwordConfirmation do not match` | `400` |
| `InvalidResetTokenError` | `Invalid or expired link` | `400` |
| `InvalidPasswordError` | from `@shared` `Password.create` | `400` |

Reuse `@shared` `Password` + `InvalidPasswordError`. Auth application does **not** call `Employee.changePassword`.

## Application contracts

### DTO — `application/dtos/complete-password-reset.dto.ts`

```ts
interface CompletePasswordResetDto {
  token: string
  password: string
  passwordConfirmation: string
}

interface CompletePasswordResetResultDto {
  id: string
}
```

### HTTP request — `presentation/http/complete-password-reset.request.ts`

```ts
export type CompletePasswordResetRequest = {
  token?: string
  password?: string
  passwordConfirmation?: string
}
```

### Write port

```ts
// application/ports/outbound/replace-authenticatable-password.port.ts
export interface ReplaceAuthenticatablePasswordPort {
  replacePasswordHash(input: {
    id: string
    passwordHash: string
  }): Promise<void>
}
```

`EmployeeAuthAdapter` implements it as:

```ts
updateOne(
  { _id: id },
  { $set: { password: passwordHash }, $inc: { sessionVersion: 1 } },
)
```

`$set` **only** `password`. `$inc` **only** `sessionVersion`. Do not write the rest of the Employee document.

## Use case flow (normative)

Constructor: token `findByTokenHash` + `deleteByOwnerId`, `HashResetTokenPort`, `FindAuthenticatableByIdPort`, `EncrypterPort`, `ReplaceAuthenticatablePasswordPort`, optional `now`.

```ts
1. if (password !== passwordConfirmation) → PasswordNotMatchError (do not consume)
2. Password.create(password) → VO errors (do not consume)
3. hash(token); findByTokenHash. Miss or expiresAt <= now → InvalidResetTokenError (do not delete on miss/expiry)
4. findAuthenticatableById(ownerId). Miss or !loginCapable → deleteByOwnerId → InvalidResetTokenError (same message)
5. EncrypterPort.encrypt(password)
6. replacePasswordHash({ id: ownerId, passwordHash })
7. deleteByOwnerId
8. return { id: ownerId }
```

No `TokenProviderPort`. No Session Token.

Expired row: treat as invalid link. Deleting an expired row is optional cleanup; **must not** write the password.

## Wiring

`makeAuthModule({ connection, compareHash, encrypter, mailer })`.

`app.ts`: pass the same `bcryptAdapter` as `compareHash` **and** `encrypter`.

```ts
router.post('/password-reset/complete', adaptRoute(completePasswordResetController))
```

## Files

| File | Action |
|------|--------|
| `domain/errors/auth.errors.ts` | Add two classes |
| `application/dtos/complete-password-reset.dto.ts` | Create |
| `application/ports/inbound/complete-password-reset.port.ts` | Create |
| `application/ports/outbound/replace-authenticatable-password.port.ts` | Create |
| `application/usecases/complete-password-reset.usecase.ts` + spec | Create |
| `presentation/http/complete-password-reset.request.ts` | Create |
| `presentation/controllers/complete-password-reset.controller.ts` + spec | Create |
| `employee-auth.adapter.ts` + spec | `replacePasswordHash` |
| `auth.routes.ts` / `auth.module.ts` / `app.ts` | Wire `encrypter` + route |
| `AGENT.md` / `.http` | Slice 6 |

## Spec expectations

### `complete-password-reset.usecase.spec.ts`

Stub hasher (`hash` → `'hashed-token'`), token repo, find-by-id (`loginCapable: true`, `id: 'owner-id'`), encrypter (`encrypt` → `'bcrypt-hash'`), replace port. Outstanding row: `{ ownerId: 'owner-id', tokenHash: 'hashed-token', expiresAt: future }`.

| `it(...)` | Assert |
|-----------|--------|
| mismatch | `PasswordNotMatchError`; findByTokenHash **not** called; delete **not** called |
| `Password.create` reject (`weak`) | `InvalidPasswordError`; token row intact (delete not called) |
| unknown hash / miss | `InvalidResetTokenError`; replace **not** called |
| `expiresAt` in the past | `InvalidResetTokenError`; replace not called |
| owner miss | `deleteByOwnerId` then `InvalidResetTokenError`; replace not called |
| `loginCapable: false` | delete then `InvalidResetTokenError`; replace not called |
| happy path | encrypt → replace `{ id, passwordHash: 'bcrypt-hash' }` → delete → `{ id: 'owner-id' }` |
| happy path | `TokenProvider` **not** injected / not called |

### `complete-password-reset.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| missing token / password / passwordConfirmation | `400`; port not called |
| success | `200` `{ data: { id } }`; body has **no** `token` |
| `PasswordNotMatchError` | `400` that message |
| `InvalidPasswordError` | `400` |
| `InvalidResetTokenError` | `400` `Invalid or expired link` |
| unexpected | `500` |

### `employee-auth.adapter.spec.ts` (add)

| `it(...)` | Assert |
|-----------|--------|
| `replacePasswordHash` `updateOne` | `$set: { password }` and `$inc: { sessionVersion: 1 }` only |

### Middleware regression (slice 3 spec or a focused case)

After `$inc`, claim `0` vs stored `1` is already specified in slice 3. Add a one-liner in the complete use-case spec comment or re-assert the adapter `$inc` — do not re-implement middleware here. If you add an integration-style unit: stub find-by-id returning `sessionVersion: 1` and run the middleware with claim `0` → `401` (optional; slice 3 already owns this).

## Checklist (agent)

- [ ] Mismatch / weak password do **not** delete the token
- [ ] Not login-capable **does** delete, same `InvalidResetTokenError`
- [ ] Success: bcrypt + `$set`/`$inc` + delete; response `{ id }` only
- [ ] Auth-owned mismatch error; same message as Create
- [ ] No employees domain import
- [ ] Route unauthenticated; no JWT issued
- [ ] `app.ts` passes `encrypter`
- [ ] Co-located specs pass

## Out of scope

- Generate-secure-password HTTP
- Auto-login
- JWT status re-check on Deactivate / Remove
- `auth.http` / `AGENT.md` (slice 6)

## Acceptance criteria

- [ ] Valid token + matching strong passwords → `{ id }`; token unusable (deleted); no JWT
- [ ] Mismatch / weak → `400`; delete not called
- [ ] Expired / unknown / reused → `400` invalid-or-expired; no password write
- [ ] Owner not login-capable → delete + same `400`
- [ ] `replacePasswordHash` increments `sessionVersion` (old JWT fails slice-3 middleware)

## Reference map

| Concern | Look at |
|---------|---------|
| `Password` VO | `@shared/domain` `Password.create` |
| Create mismatch message | `employees/.../PasswordNotMatchError` — **copy the message, not the class** |
| Login opacity | `AuthenticationError` — do **not** use it on complete |
| Design complete | design §8.3 |
| Next slice | [`06-contract.md`](./06-contract.md) |
