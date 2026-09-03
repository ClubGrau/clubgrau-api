# Spec: Slice 3 — Middleware `sessionVersion` check

> After decode, load the authenticatable and refuse a stale Session Token.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`01`](./01-persistence-seams.md), [`02`](./02-login-tighten.md) (snapshot has `sessionVersion`; JWT carries the claim).  
> Design §8.4 / [ADR 0008](../../adr/password-reset/0008-session-version-invalidates-jwts.md).  
> Next: [`04-request-command.md`](./04-request-command.md).

## Responsibility (this spec only)

`authTokenMiddleware` becomes **async**: verify signature, then `findAuthenticatableById`, then compare `sessionVersion`. Miss / mismatch → `401` `{ error: 'Invalid token' }`. Do **not** refuse `INACTIVE` / `REMOVED` here.

| Spec | Responsibility |
|------|----------------|
| [`02`](./02-login-tighten.md) | Claim exists; missing → `0` |
| **This file** | `FindAuthenticatableById` + middleware compare + module wiring |
| [`05`](./05-complete-command.md) | `$inc` so a pre-complete JWT mismatches |
| Lifecycle sibling | Live **status** re-check — **not** this slice |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `FindAuthenticatableByIdPort` | Yes |
| `EmployeeAuthAdapter.findAuthenticatableById` | Yes |
| `makeAuthTokenMiddleware(decoder, findById)` async | Yes |
| `makeAuthModule` passes the adapter as `findById` | Yes |
| Request / complete / `$inc` | **No** |
| Refuse `INACTIVE` after decode | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of password-reset following [`docs/specs/password-reset/03-middleware-session-version.md`](./03-middleware-session-version.md).  
> Add `FindAuthenticatableById` on the employee auth adapter. `authTokenMiddleware` becomes async: after decode, load + compare `sessionVersion`; miss / mismatch → `401` `{ error: 'Invalid token' }`.  
> Do not refuse `INACTIVE` here. Wire `findById` in `makeAuthModule`.

## Application port

File: `application/ports/outbound/find-authenticatable-by-id.port.ts` (spell **authenticatable**; do not rename the existing email port file).

```ts
export interface FindAuthenticatableByIdPort {
  findAuthenticatableById(id: string): Promise<AuthenticatableUser | null>
}
```

`EmployeeAuthAdapter` implements email + id. `findOne({ _id: id })` + same mapper as email. Invalid ObjectId / miss → `null` (do not throw a 400 from the adapter).

## Middleware (normative)

File: `auth-token.middleware.ts`.

Today: sync, decode, `req.decoded = payload`, `next()`.

Change factory to:

```ts
makeAuthTokenMiddleware(
  tokenDecoder: TokenDecoderPort<TokenPayload>,
  findAuthenticatableById: FindAuthenticatableByIdPort,
): AuthTokenMiddleware
```

`AuthTokenMiddleware` return type may stay `void` while the function is `async` (Express 4 ignores the promise). Catch internally; do not rely on Express error middleware.

After a **successful** decode:

1. `findAuthenticatableById(decoded.id)`. Miss → `401` `{ error: 'Invalid token' }`. Do **not** call `next()`.
2. `(decoded.sessionVersion ?? 0) !== user.sessionVersion` → same `401`.
3. Otherwise `req.decoded = payload` (`TokenPayload` only — no `passwordHash` / `loginCapable`) and `next()`.

Keep existing early exits:

| Header | Status | Body |
|--------|--------|------|
| missing `Authorization` | `401` | `{ error: 'Token not provided' }` |
| `Bearer` without token | `401` | `{ error: 'Token not provided' }` |
| `decode` throws | `401` | `{ error: 'Invalid token' }` |

Do **not** look up when decode failed.

### I/O failure ([design §17 Q6](../../design-docs/password-reset-v1.md))

- Miss / mismatch → `401` `{ error: 'Invalid token' }` (do not leak whether the id exists beyond that copy).
- Unexpected adapter rejection (network / driver) → `500` `{ error }` (use a generic message; do not leak the id). Fail closed: `next()` is not called.

Do not gate on `user.status` or `user.loginCapable`. An `INACTIVE` collaborator with a matching `sessionVersion` still passes this middleware (lifecycle sibling).

## Wiring

`makeAuthModule`: `makeAuthTokenMiddleware(jwtTokenAdapter, findAuthenticatableByEmailAdapter)` — same `EmployeeAuthAdapter` instance is fine.

`app.ts` signature unchanged (still receives `authTokenMiddleware`). Employees/customers keep consuming the function; they do not need to know it is async.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/find-authenticatable-by-id.port.ts` | Create |
| `employee-auth.adapter.ts` + `*.spec.ts` | `findAuthenticatableById` |
| `auth-token.middleware.ts` + `*.spec.ts` | Async compare |
| `auth.module.ts` | Inject `findById` |
| Request / complete / `$inc` | Do not add |

## Spec expectations

### `employee-auth.adapter.spec.ts` (add)

| `it(...)` | Assert |
|-----------|--------|
| `findAuthenticatableById` `findOne` `{ _id }` | mapped snapshot |
| miss | `null` |

Reuse the mapper (includes `loginCapable` / `sessionVersion` from slice 2).

### `auth-token.middleware.spec.ts`

`makeSut` now stubs `FindAuthenticatableByIdPort` (`jest.fn().mockResolvedValue({ ..., sessionVersion: 0, loginCapable: true })`). Tests become `async` and **await** `sut(req, res, next)` (or `void sut(...)` then `await flush` — prefer awaiting the returned promise).

Keep existing header / decode-throw cases (find **not** called).

| `it(...)` | Assert |
|-----------|--------|
| valid token + stored `0` + claim `0` | `next()`; `req.decoded` is the payload; find called with `decoded.id` |
| claim missing / `undefined` treated as `0` vs stored `0` | `next()` (legacy OK) |
| claim `0` vs stored `1` | `401` `{ error: 'Invalid token' }`; `next` not called |
| claim `1` vs stored `0` | same `401` |
| find returns `null` | `401` `{ error: 'Invalid token' }` |
| find rejects | `500`; `next` not called |
| decode throws | `401` Invalid token; find **not** called |
| user `status: 'INACTIVE'` + matching version | `next()` — do **not** refuse |

`req.decoded` must not include `passwordHash` or `loginCapable`.

## Checklist (agent)

- [ ] Middleware is async and still Express-safe (errors handled inside)
- [ ] Compare uses `?? 0` on the claim
- [ ] Miss / mismatch → `401` Invalid token
- [ ] Unexpected I/O → `500`
- [ ] `INACTIVE` with matching version is **allowed**
- [ ] `makeAuthModule` wires `findById`
- [ ] No reset HTTP; no `$inc`

## Out of scope

- Request / complete commands
- Re-check live status after decode
- Incrementing `sessionVersion` (slice 5)

## Acceptance criteria

- [ ] Matching `0` / `0` (including omitted claim) → `next()`
- [ ] Mismatch or missing user → `401` `{ error: 'Invalid token' }`
- [ ] Adapter throw → `500`
- [ ] `INACTIVE` + match → still authenticated at this layer
- [ ] Middleware + adapter specs pass; existing employees routes still receive `req.decoded`

## Reference map

| Concern | Look at |
|---------|---------|
| Middleware today | `auth-token.middleware.ts` |
| Adapter today | `employee-auth.adapter.ts` |
| Why `sessionVersion` | [ADR 0008](../../adr/password-reset/0008-session-version-invalidates-jwts.md) |
| Next slice | [`04-request-command.md`](./04-request-command.md) |
