# Auth Module — Agent Guide

> Living **contract** of the auth hexagon (Login + Password Reset request/complete + Session Token middleware).
>
> Global rules (architecture, naming, testing, playbooks): [`AGENTS.md`](../../../AGENTS.md).  
> Structure diagrams / folder tree: [`docs/project-structure.md`](../../../docs/project-structure.md).  
> Glossary: [`CONTEXT.md`](./CONTEXT.md). Product/design: [`docs/prd/password-reset-v1.md`](../../../docs/prd/password-reset-v1.md), [`docs/design-docs/password-reset-v1.md`](../../../docs/design-docs/password-reset-v1.md). ADRs: [`docs/adr/password-reset/`](../../../docs/adr/password-reset/).

## Purpose of this document

Use this file to extend **this** module without breaking its current contracts:

- Public HTTP surface, ports, DTOs, domain invariants
- Persistence mapping and wiring specific to auth (Reset Token collection, employee credentials adapter, JWT)

### When to update this document

**Do not** treat this as a changelog. Trivial refactors, typo fixes, and test-only tweaks do **not** need an entry here.

**Do update** when any of the following change for auth:

| Change type | Examples |
|-------------|----------|
| Public HTTP surface | New route, method, path, or response shape |
| Domain invariants | `loginCapable` rule, Reset Token consume/cooldown, session invalidation |
| Ports / DTOs | New inbound/outbound port, DTO fields, return contracts |
| Persistence mapping | Employee `sessionVersion`, `PasswordResetToken` schema, hasher |
| Open decisions | Resolved TODOs, new known limitations |
| Module layout | New folder under this hexagon, wiring pattern change local to auth |

Global convention changes belong in [`AGENTS.md`](../../../AGENTS.md), not here.

After a meaningful change, update the relevant section(s) in place.

---

## Module status

### Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| Login (command) | Done | `POST /auth` |
| Request password reset (command) | Done | `POST /auth/password-reset` |
| Complete password reset (command) | Done | `POST /auth/password-reset/complete` |
| Session Token on employee/customer routes | Done | `authTokenMiddleware` (`sessionVersion` check after decode) |
| Role gate (employees create/list) | Done | `requireRoles` (`makeRequireRoles`) |
| Module HTTP ownership | Done | `infrastructure/inbound/http/auth.routes.ts` |
| Composition root wiring | Done | `auth.module.ts` + `app.ts` |

Password Reset is **Done** (slices 0–5 shipped). It is not planned work.

### CQRS in this module

| Side | Location | Example |
|------|----------|---------|
| Command (write) | `application/usecases/` | `LoginUseCase`, `RequestPasswordResetUsecase`, `CompletePasswordResetUsecase` |
| Query (read) | — | none |

Auth has no list/get query. Reads of Employee credentials go through the employee auth adapter (`AuthenticatableUser`), not through employees use cases.

### Future work

- Auth sibling of employee-lifecycle: re-check live status after JWT decode (see Open decisions). **Do not implement in this feature.**
- Identity extraction (`users` hexagon) — still deferred (option B).
- Generate-secure-password HTTP — rejected; frontend-only.

---

## Directory map

```text
src/modules/auth/
├── AGENT.md                          # this file (module contract)
├── CONTEXT.md                        # glossary only (Password Reset / Reset Token / Session Token)
├── auth.module.ts                    # composition / DI for the hexagon
│
├── domain/
│   ├── models/
│   │   ├── authenticatable-user.model.ts
│   │   ├── token-payload.model.ts
│   │   └── password-reset-token.model.ts
│   └── errors/
│       └── auth.errors.ts
│
├── application/
│   ├── dtos/
│   │   ├── login.dto.ts
│   │   ├── login.dto.spec.ts
│   │   ├── request-password-reset.dto.ts
│   │   └── complete-password-reset.dto.ts
│   ├── ports/
│   │   ├── inbound/
│   │   │   ├── login.port.ts
│   │   │   ├── request-password-reset.port.ts
│   │   │   └── complete-password-reset.port.ts
│   │   └── outbound/
│   │       ├── find-authenticable-by-email.port.ts
│   │       ├── find-authenticatable-by-id.port.ts
│   │       ├── update-employee-credentials.port.ts
│   │       ├── find-reset-token-by-owner-id.port.ts
│   │       ├── find-reset-token-by-hash.port.ts
│   │       ├── upsert-reset-token.port.ts
│   │       ├── delete-reset-token-by-owner-id.port.ts
│   │       ├── hash-reset-token.port.ts
│   │       ├── generate-raw-reset-token.port.ts
│   │       ├── token-provider.port.ts
│   │       └── token-decoder.port.ts
│   └── usecases/
│       ├── login.usecase.ts
│       ├── login.usecase.spec.ts
│       ├── request-password-reset.usecase.ts
│       ├── request-password-reset.usecase.spec.ts
│       ├── complete-password-reset.usecase.ts
│       └── complete-password-reset.usecase.spec.ts
│
├── presentation/
│   ├── http/
│   │   ├── request-password-reset.request.ts
│   │   └── complete-password-reset.request.ts
│   └── controllers/
│       ├── auth.controller.ts
│       ├── auth.controller.spec.ts
│       ├── request-password-reset.controller.ts
│       ├── request-password-reset.controller.spec.ts
│       ├── complete-password-reset.controller.ts
│       └── complete-password-reset.controller.spec.ts
│
└── infrastructure/
    ├── inbound/http/
    │   ├── auth.routes.ts
    │   ├── auth-token.middleware.ts
    │   ├── auth-token.middleware.spec.ts
    │   ├── require-roles.middleware.ts
    │   └── require-roles.middleware.spec.ts
    └── outbound/
        ├── persistence/
        │   ├── employee-auth.adapter.ts
        │   ├── employee-auth.adapter.spec.ts
        │   ├── employee-authenticatable.mapper.ts
        │   ├── employee-authenticatable.mapper.spec.ts
        │   ├── password-reset-token.schema.ts
        │   ├── password-reset-token.mapper.ts
        │   ├── password-reset-token-mongoose.repository.ts
        │   └── password-reset-token-mongoose.repository.spec.ts
        ├── crypto/
        │   ├── hmac-reset-token-hasher.ts
        │   ├── hmac-reset-token-hasher.spec.ts
        │   └── crypto-raw-reset-token.generator.ts
        └── token/
            ├── jwt-token.adapter.ts
            └── jwt-token.adapter.spec.ts
```

Related outside the module:

| Path | Role |
|------|------|
| `src/app.ts` | Injects `BcryptAdapter` (`compareHash` + `encrypter`) + `ResendMailerAdapter` + `FRONTEND_PUBLIC_ORIGIN`; mounts `/auth` |
| `@shared/application/ports/mailer.port.ts` | `MailerPort.send({ to, template, vars })` — template `'password-reset'` |
| `@shared/infrastructure/adapters/resend` | Production mailer; tests use an in-memory fake |
| `@shared/application/ports` | `EncrypterPort`, `CompareHashPort` |
| `src/modules/employees/.../employee.schema.ts` | Credentials + `sessionVersion` (auth writes via adapter only) |
| `src/client/auth.http` | Manual REST Client requests |
| [`AGENTS.md`](../../../AGENTS.md) | Global constitution |
| [`docs/project-structure.md`](../../../docs/project-structure.md) | Repo-wide structure diagrams |

---

## Domain model

Glossary (language only): [`CONTEXT.md`](./CONTEXT.md). Do not put HMAC, Resend, `sessionVersion`, or file paths there.

### `AuthenticatableUser`

Auth-owned snapshot of a login-capable collaborator. Independent of `Employee` / `Customer` enums — the adapter fills it.

```ts
type AuthenticatableUser = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  status: string;
  role: string;
  loginCapable: boolean;   // derived in the mapper; never a JWT claim
  sessionVersion: number;  // JWT claim; default 0 when missing
};
```

### `TokenPayload`

```ts
type TokenPayload = Omit<AuthenticatableUser, 'passwordHash' | 'loginCapable'>;
```

JWT never carries `passwordHash` or `loginCapable`.

### `PasswordResetToken`

Write snapshot of the outstanding Reset Token (not an entity). Raw token is never stored.

```ts
type PasswordResetToken = {
  ownerId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
};
```

### Domain errors (`auth.errors.ts`)

| Error | Message | When |
|-------|---------|------|
| `AuthenticationError` | `Authentication failed` | Unknown email, wrong password, or `!loginCapable` (same opacity) |
| `PasswordResetedNotMatchError` | `Password and passwordConfirmation do not match` | Complete: confirmation mismatch (auth-owned; not employees `PasswordNotMatchError`) |
| `InvalidOrExpiredTokenError` | `Invalid or expired link` | Complete: unknown / expired / consumed / owner not login-capable |

All extend `@shared/domain/errors/domain.error`. Weak password is `InvalidPasswordError` from `@shared/domain` (`Password.create`) — not an auth-owned class.

---

## Application: Login (command)

### Ports

```ts
interface LoginPort {
  execute(params: LoginDto): Promise<LoginResultDto>;
}

interface FindAuthenticatableByEmailPort {
  findAuthenticatableByEmail(email: string): Promise<AuthenticatableUser | null>;
}

interface TokenProviderPort<T> {
  generateToken(payload: T): LoginResultDto;
}
```

### DTOs

```ts
interface LoginDto {
  email: string;
  password: string;
}

interface LoginResultDto {
  token: string;
}
```

### Use case flow (`LoginUseCase`)

1. `findAuthenticatableByEmail` — miss or `!loginCapable` → `AuthenticationError` (opaque)
2. `CompareHashPort.compare` — false → same `AuthenticationError`
3. `TokenProviderPort.generateToken` with `{ id, name, email, role, status, sessionVersion }`
4. Return `{ token }`

Gate is **`loginCapable`**, not a hardcoded `ACTIVE`. `VACATION` logs in. `INACTIVE` / `REMOVED` / unknown share the same `401`.

The mapper (`mapEmployeeDocumentToAuthenticatable`) is the **only** place that knows `'ACTIVE' | 'VACATION'`. Domain and use cases do not import employees `Status`.

---

## Application: Request Password Reset (command)

Send-then-persist ([ADR 0011](../../../docs/adr/password-reset/0011-reset-request-sends-before-persist.md)). Cooldown 15 minutes from `issuedAt`. Token TTL 30 minutes.

### Ports

```ts
interface RequestPasswordResetPort {
  execute(params: RequestPasswordResetDto): Promise<RequestPasswordResetResultDto>;
}

interface RequestPasswordResetDto {
  email: string;
}

interface RequestPasswordResetResultDto {
  ok: true;
}
```

Outbound: `FindAuthenticatableByEmailPort`, `FindResetTokenByOwnerIdPort`, `UpsertResetTokenPort`, `HashResetTokenPort`, `GenerateRawResetTokenPort`, shared `MailerPort`.

### Use case flow (`RequestPasswordResetUsecase`)

1. Find by email — miss or `!loginCapable` → `{ ok: true }` (no token, no email, no upsert)
2. Outstanding token issued within 15 min → `{ ok: true }` (leave the current token alone)
3. Generate raw token (32 bytes base64url); compose `resetUrl` = `${FRONTEND_PUBLIC_ORIGIN}/reset-password?token=${raw}`
4. `MailerPort.send({ to, template: 'password-reset', vars: { resetUrl } })`
5. Send fail → `{ ok: true }` (do **not** persist; previous row unchanged). Log has no raw token / URL.
6. HMAC the raw token; `upsertByOwnerId` (last wins)
7. Always return `{ ok: true }`

Never put the raw token on the result DTO or HTTP body.

---

## Application: Complete Password Reset (command)

Does **not** issue a Session Token. Consume = delete the row.

### Ports

```ts
interface CompletePasswordResetPort {
  execute(params: CompletePasswordResetDto): Promise<CompletePasswordResetResultDto>;
}

interface CompletePasswordResetDto {
  token: string;
  password: string;
  passwordConfirmation: string;
}

interface CompletePasswordResetResultDto {
  id: string;
}

interface UpdateEmployeeCredentialsPort {
  updateCredentials(ownerId: string, passwordHash: string): Promise<void>;
}
```

### Use case flow (`CompletePasswordResetUsecase`)

1. `Password.create(password)` — weak → `InvalidPasswordError` (token not looked up; still usable)
2. `password !== passwordConfirmation` → `PasswordResetedNotMatchError` (token not looked up)
3. HMAC raw token; `findByTokenHash` — miss → `InvalidOrExpiredTokenError`
4. Expired → `deleteByOwnerId` then same `InvalidOrExpiredTokenError`
5. Load owner by id; miss or `!loginCapable` → delete then same `InvalidOrExpiredTokenError`
6. `EncrypterPort.encrypt` (bcrypt) → `updateCredentials` (`$set` password + `$inc sessionVersion`)
7. `deleteByOwnerId` (consume)
8. Return `{ id }` — **no** JWT

Policy / VO failures (steps 1–2) do **not** delete the token.

---

## Presentation & HTTP

Mounted at `/auth` in `app.ts`. Request and complete are **unauthenticated** — do not run `authTokenMiddleware` on them.

### Controllers

`AuthController` extends `BaseController`:

- Required fields: `email`, `password`
- Missing field → `400` + `MissingParamError`
- Success → `200` + `{ data: { token } }` via `ok(...)`
- `AuthenticationError` → `401` `unauthorized`
- Unexpected → `serverError`

`RequestPasswordResetController` extends `BaseController`:

- Required field: `email`
- Missing → `400` + `MissingParamError`
- Success (always, after the use case) → `200` + `{ data: { ok: true } }`
- Unexpected → `serverError`
- Raw HTTP body: `RequestPasswordResetRequest`

`CompletePasswordResetController` extends `BaseController`:

- Required fields: `token`, `password`, `passwordConfirmation`
- Missing → `400` + `MissingParamError`
- Success → `200` + `{ data: { id } }` via `ok(...)` — **no** token
- `PasswordResetedNotMatchError` / `InvalidOrExpiredTokenError` → `400` `badRequest`
- Unexpected (including unmapped `InvalidPasswordError` from `Password.create`) → `serverError`
- Raw HTTP body: `CompletePasswordResetRequest`

### Routes

```ts
// auth.routes.ts
router.post('/', adaptRoute(authController));
router.post('/password-reset', adaptRoute(requestPasswordResetController));
router.post('/password-reset/complete', adaptRoute(completePasswordResetController));
```

Mounted in `app.ts` as:

```text
POST /auth
POST /auth/password-reset
POST /auth/password-reset/complete
```

### HTTP table (design §9)

| Result | Status | Body |
|--------|--------|------|
| Login OK (`ACTIVE` or `VACATION`) | `200` | `{ data: { token } }` |
| Login unknown / wrong password / not login-capable | `401` | `{ error }` opaque (`AuthenticationError`) |
| Request (any email / cooldown / mail fail) | `200` | `{ data: { ok: true } }` |
| Complete OK | `200` | `{ data: { id } }` — **no** token |
| Complete missing fields | `400` | `{ error }` |
| Complete mismatch | `400` | `{ error }` (`PasswordResetedNotMatchError`) |
| Complete invalid / expired / consumed / not login-capable | `400` | `{ error }` (`Invalid or expired link`) |
| Authenticated route, `sessionVersion` mismatch / miss | `401` | `{ error: 'Invalid token' }` |
| Unexpected | `500` | `{ error }` |

No `403` / `409` on these three routes.

Manual samples: `src/client/auth.http`.

### `authTokenMiddleware`

`makeAuthTokenMiddleware(decoder, findById)`:

1. Missing / blank `Authorization` → `401` `{ error: 'Token not provided' }`
2. Decode fail → `401` `{ error: 'Invalid token' }`
3. `findAuthenticatableById` I/O fail → `500`
4. Miss → `401` `{ error: 'Invalid token' }`
5. `(decoded.sessionVersion ?? 0) !== user.sessionVersion` → `401` `{ error: 'Invalid token' }`
6. Else `req.decoded = decoded` and `next()`

Does **not** refuse `INACTIVE` / `REMOVED` by live status. Missing JWT `sessionVersion` compares as `0` (legacy tokens stay valid until complete increments the stored version).

---

## Persistence

### Employee (credentials stay here)

- Schema field `sessionVersion: { type: Number, default: 0 }`
- Entity / `toCreate` / update-status `$set` / anonymize `$set`: **do not** mention `sessionVersion`
- Auth write on complete only, via `EmployeeAuthAdapter.updateCredentials`:

```ts
findOneAndUpdate(
  { _id: ownerId },
  { $set: { password: passwordHash }, $inc: { sessionVersion: 1 } },
)
```

### Mapper (anti-corruption)

`mapEmployeeDocumentToAuthenticatable` is the only place that knows `'ACTIVE' | 'VACATION'`:

```ts
loginCapable: LOGIN_CAPABLE_STATUSES.has(document.status)  // ACTIVE | VACATION
sessionVersion: document.sessionVersion ?? 0
```

`EmployeeAuthAdapter` implements `FindAuthenticatableByEmailPort`, `FindAuthenticatableByIdPort`, `UpdateEmployeeCredentialsPort`. It must **not** import employees domain.

### `PasswordResetToken` (auth collection)

Indexes: unique `ownerId`; unique `tokenHash`. `expiresAt` has a Mongo TTL index (`expires: 0`) for cleanup. **Application expiry check is still mandatory.**

| Method | Behaviour |
|--------|-----------|
| `findByOwnerId` | Outstanding row or `null` |
| `findByTokenHash` | Outstanding row or `null` |
| `upsertByOwnerId` | Replace hash + `issuedAt` + `expiresAt` (last wins) |
| `deleteByOwnerId` | Consume |

Repository stores the hash it is given — it never calls the hasher.

### Hasher

`HmacResetTokenHasher` (`HashResetTokenPort`): HMAC-SHA256 with `PASSWORD_RESET_PEPPER`. Not `EncrypterPort`. **No fallback to `JWT_SECRET`.**

### Env

| Var | Role |
|-----|------|
| `JWT_SECRET` / `TOKEN_EXPIRATION_TIME` | Session Token |
| `PASSWORD_RESET_PEPPER` | HMAC of the Reset Token |
| `FRONTEND_PUBLIC_ORIGIN` | Origin for `resetUrl` (no trailing path) |
| `RESEND_API_KEY` / `RESEND_FROM` | Resend adapter |

---

## Wiring (`auth.module.ts`)

Factory: `makeAuthModule({ connection, compareHash, encrypter, mailer, frontendPublicOrigin })`.

`app.ts` passes the same `BcryptAdapter` as `compareHash` and `encrypter`, plus `ResendMailerAdapter` and `envs.frontendPublicOrigin`.

Composition order today:

1. `connection.model('Employee', EmployeeSchema)` + `EmployeeAuthAdapter`
2. `JwtTokenAdapter`
3. `connection.model('PasswordResetToken', PasswordResetTokenSchema)` + repository
4. `HmacResetTokenHasher` + `CryptoRawResetTokenGenerator`
5. `LoginUseCase(adapter, compareHash, jwt)`
6. `RequestPasswordResetUsecase(adapter, repo, repo, hasher, generator, mailer, frontendPublicOrigin)`
7. `CompletePasswordResetUsecase(repo, adapter, repo, adapter, encrypter, hasher)`
8. Controllers + `makeAuthRoutes`
9. `makeAuthTokenMiddleware(jwtTokenAdapter, employeeAuthAdapter)`

Returns `{ authController, requestPasswordResetController, completePasswordResetController, login, requestPasswordReset, completePasswordReset, authTokenMiddleware, makeRequireRoles, router }`.

**Rule:** when adding a use case, wire it in this file; do not construct repositories inside controllers or use cases.

---

## Request → response sequences

**Request** (design §13)

```text
Client (login screen)
  → auth.routes POST /password-reset (no authTokenMiddleware)
  → RequestPasswordResetController
  → RequestPasswordResetUsecase
      → find by email
      → if !loginCapable or cooldown: 200 { ok: true }
      → generate raw token, compose resetUrl
      → MailerPort.send
      → on send fail: 200 { ok: true } (no persist)
      → upsert hashed token
  → 200 { data: { ok: true } }
```

**Complete**

```text
Client (frontend /reset-password)
  → auth.routes POST /password-reset/complete (no authTokenMiddleware)
  → CompletePasswordResetController
  → CompletePasswordResetUsecase
      → mismatch / Password.create → error, row intact
      → HMAC + findByTokenHash
      → load owner; if !loginCapable: delete row → 400
      → bcrypt hash
      → $set password, $inc sessionVersion
      → delete row
  → 200 { data: { id } }
```

**Login (after complete, or VACATION)**

```text
Client
  → AuthController
  → LoginUseCase
      → find by email, loginCapable, compare
      → JWT with sessionVersion
  → 200 { data: { token } }
```

**Authenticated route after complete (old JWT)**

```text
Client
  → authTokenMiddleware
      → decode
      → findById
      → sessionVersion mismatch → 401 Invalid token
```

---

## Module checklist (extend auth)

Follow the global playbook in [`AGENTS.md`](../../../AGENTS.md). For this module specifically:

1. Domain / DTO / ports / use case / controller / route / adapter or repo as needed + specs
2. Wire in `auth.module.ts`
3. Update `src/client/auth.http` if HTTP surface changed
4. Update **this** `AGENT.md` (status, ports, HTTP, open decisions)
5. Keep [`CONTEXT.md`](./CONTEXT.md) as glossary only

Never shortcut by calling the repository from the controller. Never return a Reset Token in HTTP. Never auto-login after complete.

---

## Open decisions / known limitations

1. **Email HTML vs Resend template id** — adapter composes a minimal body with `resetUrl` only (design §17 Q3). Swap later without changing `MailerPort`.
2. **Mongo TTL on `expiresAt`** — shipped as `expires: 0` (cleanup). Application expiry check is still mandatory.
3. **Session after INACTIVE / REMOVED (lifecycle sibling)** — after `authTokenMiddleware` decodes the JWT and compares `sessionVersion`, also refuse a live status that is not login-capable (`INACTIVE` / `REMOVED`) with opaque `401`. Product: deactivated / removed must not keep using the API. **Do not implement in this feature.** Complete already kills tokens via `sessionVersion`. `VACATION` remains login-capable. Whether VACATION stays a full session at the middleware is part of that sibling, not this hexagon’s current contract.
4. **Identity extraction (`users`)** — still deferred (option B). Credentials stay on Employee; auth reaches them through the adapter.
5. **Complete weak-password HTTP** — use case throws `InvalidPasswordError` before token lookup (token stays usable). Controller maps only `PasswordResetedNotMatchError` and `InvalidOrExpiredTokenError` to `400`; an unmapped VO error is `500` today.

Do not duplicate ADR essays; link [`docs/adr/password-reset/`](../../../docs/adr/password-reset/).

---

## Quick reference: file ownership

| Concern | Owner file |
|---------|------------|
| Glossary | `CONTEXT.md` |
| Login-capable snapshot | `domain/models/authenticatable-user.model.ts` |
| JWT claims | `domain/models/token-payload.model.ts` |
| Reset Token write snapshot | `domain/models/password-reset-token.model.ts` |
| Auth errors | `domain/errors/auth.errors.ts` |
| Login orchestration | `application/usecases/login.usecase.ts` |
| Request orchestration | `application/usecases/request-password-reset.usecase.ts` |
| Complete orchestration | `application/usecases/complete-password-reset.usecase.ts` |
| Login HTTP | `presentation/controllers/auth.controller.ts` |
| Request HTTP | `presentation/controllers/request-password-reset.controller.ts` |
| Complete HTTP | `presentation/controllers/complete-password-reset.controller.ts` |
| Routes | `infrastructure/inbound/http/auth.routes.ts` |
| Session middleware | `infrastructure/inbound/http/auth-token.middleware.ts` |
| Employee credentials adapter | `infrastructure/outbound/persistence/employee-auth.adapter.ts` |
| `loginCapable` mapping | `infrastructure/outbound/persistence/employee-authenticatable.mapper.ts` |
| Reset Token Mongo I/O | `infrastructure/outbound/persistence/password-reset-token-mongoose.repository.ts` |
| HMAC hasher | `infrastructure/outbound/crypto/hmac-reset-token-hasher.ts` |
| JWT encode/decode | `infrastructure/outbound/token/jwt-token.adapter.ts` |
| DI | `auth.module.ts` |
| App mount | `src/app.ts` → `app.use('/auth', auth.router)` |
| Mailer port (shared) | `src/shared/application/ports/mailer.port.ts` |
