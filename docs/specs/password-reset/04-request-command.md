# Spec: Slice 4 — `RequestPasswordReset` (command)

> Unauthenticated request: email in → always opaque `200`; maybe one email.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`00-mailer-seam.md`](./00-mailer-seam.md), [`01-persistence-seams.md`](./01-persistence-seams.md). Slice 2 is useful (mapper has `loginCapable`) but request must gate on that boolean — **implement slice 2 first if it is not already shipped**.  
> Design §8.2 / §9 / §13 / [ADR 0011](../../adr/password-reset/0011-reset-request-sends-before-persist.md).  
> Next: [`05-complete-command.md`](./05-complete-command.md).

## Responsibility (this spec only)

Ship `POST /auth/password-reset` through the hexagon: DTO → ports → use case → controller → route → module + `app.ts` mailer wiring. **Send, then persist.** Complete is **not** this slice.

| Spec | Responsibility |
|------|----------------|
| [`00`](./00-mailer-seam.md) | `MailerPort` + fake |
| [`01`](./01-persistence-seams.md) | Token repo + hasher |
| [`02`](./02-login-tighten.md) | `loginCapable` on the snapshot |
| **This file** | Request vertical slice |
| [`05`](./05-complete-command.md) | Complete |

## When to use this spec

Follow the constitution **new command** playbook. Do not merge complete into this PR/slice.

| Artifact | This slice? |
|----------|-------------|
| DTO + inbound port + request outbound ports | Yes |
| `RequestPasswordResetUsecase` + spec | Yes |
| Controller + spec + request type | Yes |
| `POST /password-reset` on `makeAuthRoutes` (no `authTokenMiddleware`) | Yes |
| `makeAuthModule({ mailer, ... })` + `app.ts` pass `ResendMailerAdapter` | Yes |
| `FRONTEND_PUBLIC_ORIGIN` on envs | Yes |
| Complete / `$inc` / hash replace | **No** |
| Return the raw token in HTTP | **No** |

**Prompt sketch for the agent:**

> Implement slice 4 of password-reset following [`docs/specs/password-reset/04-request-command.md`](./04-request-command.md).  
> Add `RequestPasswordResetUsecase`: find by email, cooldown 15 min, send-then-persist, opaque `{ ok: true }`. Compose `resetUrl` from `FRONTEND_PUBLIC_ORIGIN`.  
> HTTP `POST /auth/password-reset`. Mail fail and unknown email share the same `200`. Never return the token.

## HTTP surface

Mounted at `/auth` (`app.ts` already uses that prefix). **Unauthenticated.**

```http
POST /auth/password-reset
Content-Type: application/json

{ "email": "<email>" }
```

| Result | Status | Body |
|--------|--------|------|
| Any email / cooldown / mail fail / success | `200` | `{ data: { ok: true } }` via `ok(...)` |
| Missing `email` | `400` | `{ error }` `MissingParamError` |
| Unexpected I/O (find/upsert, not mail) | `500` | `{ error }` |

No `401` / `403` / `409`. Do not run `authTokenMiddleware` on this route.

## Application contracts

### DTO — `application/dtos/request-password-reset.dto.ts`

```ts
interface RequestPasswordResetDto {
  email: string
}

interface RequestPasswordResetResultDto {
  ok: true
}
```

### HTTP request — `presentation/http/request-password-reset.request.ts`

```ts
export type RequestPasswordResetRequest = {
  email?: string
}
```

Inbound port `RequestPasswordResetPort` with `execute(dto): Promise<RequestPasswordResetResultDto>`.

## Use case flow (normative)

`RequestPasswordResetUsecase` constructor injects:

- `FindAuthenticatableByEmailPort` (existing)
- Token repo ports: `findByOwnerId`, `upsertByOwnerId` (from slice 1)
- `HashResetTokenPort`
- `MailerPort`
- `GenerateRawResetTokenPort` **or** generate inside the use case with `crypto.randomBytes(32).toString('base64url')` — prefer a small outbound port so specs stub `'raw-token'`
- `frontendPublicOrigin: string` (from env; **no trailing slash or path**)
- Optional `now: () => Date` defaulting to `() => new Date()` (cooldown tests; do not add a shared Clock hexagon)

Flow:

1. `findAuthenticatableByEmail`. If miss or `!loginCapable` → `{ ok: true }` (no send, no persist, no generate).
2. `findByOwnerId`. If row exists and `now - issuedAt < 15 minutes` → `{ ok: true }` (do not send, do not replace).
3. Generate raw token (32 bytes, **base64url**). Compose `resetUrl = ${FRONTEND_PUBLIC_ORIGIN}/reset-password?token=${raw}`.
4. `MailerPort.send({ to: email, template: 'password-reset', vars: { resetUrl } })`.
5. If send throws: log **without** the raw token or `resetUrl`; return `{ ok: true }` (previous row untouched).
6. `hash(raw)`; `upsertByOwnerId` with `issuedAt = now`, `expiresAt = now + 30 minutes`. Last wins.
7. Return `{ ok: true }`.

Never put the raw token on the result DTO or HTTP body. Do not import employees domain.

Cooldown is **15 minutes** from `issuedAt`. TTL of the token is **30 minutes** (`expiresAt`); do not reject expired rows on request — a new request after cooldown replaces them.

## Wiring

`makeAuthModule({ connection, compareHash, mailer, /* hasher + token repo constructed inside */ })`.

`app.ts`: `new ResendMailerAdapter()` (or the slice-0 adapter) and pass `mailer`. Hasher + `PasswordResetToken` model stay inside the auth factory (like `JwtTokenAdapter`).

`makeAuthRoutes({ authController, requestPasswordResetController })`:

```ts
router.post('/', adaptRoute(authController))
router.post('/password-reset', adaptRoute(requestPasswordResetController))
```

Do not attach `authTokenMiddleware` here.

`FRONTEND_PUBLIC_ORIGIN` → `frontendPublicOrigin` on `src/configs/envs`.

## Files

| File | Action |
|------|--------|
| `application/dtos/request-password-reset.dto.ts` | Create |
| `application/ports/inbound/request-password-reset.port.ts` | Create |
| Outbound generate-raw / token ports if not created in slice 1 | Create |
| `application/usecases/request-password-reset.usecase.ts` + spec | Create |
| `presentation/http/request-password-reset.request.ts` | Create |
| `presentation/controllers/request-password-reset.controller.ts` + spec | Create |
| `auth.routes.ts` | Add POST |
| `auth.module.ts` | Wire |
| `app.ts` | Pass `mailer` |
| `src/configs/envs/index.ts` | `frontendPublicOrigin` |
| Complete / `.http` / `AGENT.md` | **No** (`.http` is slice 6; a commented sample is optional) |

## Spec expectations

### `request-password-reset.usecase.spec.ts`

`makeStubs` / `makeSut`. Stub find-email, token repo, hasher, mailer, raw generator. Inject `frontendPublicOrigin: 'https://app.example'` and a fixed `now`.

Default user: `loginCapable: true`.

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance |
| unknown email | `{ ok: true }`; mail **not** called; upsert **not** called |
| `loginCapable: false` | same as unknown |
| cooldown (`issuedAt` 1 minute ago) | `{ ok: true }`; mail not called; upsert not called |
| no outstanding row | generate → send `{ to, template: 'password-reset', vars: { resetUrl } }` → hash → upsert → `{ ok: true }` |
| `resetUrl` | `https://app.example/reset-password?token=raw-token` (no double slash) |
| send rejects | `{ ok: true }`; upsert **not** called |
| outstanding row older than 15 min | send + upsert (replace) |
| hasher receives the raw token | `hash('raw-token')` |
| result / logs | no raw token on the DTO |

Do not hit Mongo, Resend, or Express.

### `request-password-reset.controller.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| missing email | `400`; port not called |
| port returns `{ ok: true }` | `200` `{ data: { ok: true } }` |
| port throws unexpected | `500` |

Controller does not branch on “sent vs not sent”.

## Checklist (agent)

- [ ] Send **before** upsert ([ADR 0011](../../adr/password-reset/0011-reset-request-sends-before-persist.md))
- [ ] Unknown / not login-capable / cooldown / mail fail → same `{ ok: true }`
- [ ] HTTP never includes the token
- [ ] Route is unauthenticated
- [ ] `resetUrl` uses `FRONTEND_PUBLIC_ORIGIN` + `/reset-password?token=`
- [ ] Co-located specs pass
- [ ] Complete not implemented

## Out of scope

- Complete command
- `$set` password / `$inc sessionVersion`
- Writing `auth.http` samples (slice 6)
- Revealing whether the email exists

## Acceptance criteria

- [ ] Login-capable + outside cooldown → mailer called with `resetUrl`; then upsert
- [ ] Unknown / `loginCapable: false` → `200` `{ ok: true }`; no email
- [ ] Second request inside 15 minutes → `200`; no second email; no upsert
- [ ] Mailer throw → `200`; previous row not replaced
- [ ] Controller + use case specs pass

## Reference map

| Concern | Look at |
|---------|---------|
| Login controller style | `auth.controller.ts` |
| Mailer fake | slice 0 |
| Token repo / hasher | slice 1 |
| Why send-then-persist | [ADR 0011](../../adr/password-reset/0011-reset-request-sends-before-persist.md) |
| Next slice | [`05-complete-command.md`](./05-complete-command.md) |
