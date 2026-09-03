# Spec: Slice 1 — Persistence seams (`sessionVersion`, Reset Token, HMAC)

> Employee stamp + auth-owned Reset Token store + hasher.  
> Parent: [`README.md`](./README.md).  
> Depends on: none of the later slices (mailer from [`00`](./00-mailer-seam.md) is unused here).  
> Design §10 / §7.3 / [ADR 0007](../../adr/password-reset/0007-reset-token-lives-in-auth-collection.md) / [ADR 0008](../../adr/password-reset/0008-session-version-invalidates-jwts.md) / [ADR 0010](../../adr/password-reset/0010-reset-token-hash-is-hmac-sha256.md).  
> Next: [`02-login-tighten.md`](./02-login-tighten.md).

## Responsibility (this spec only)

1. Add `sessionVersion` on the **Employee schema only** (default `0`).
2. Add auth collection `PasswordResetToken` + mapper + repository.
3. Add HMAC-SHA256 hasher (dedicated pepper), **not** `EncrypterPort`.

| Spec | Responsibility |
|------|----------------|
| **This file** | Schema field, token collection, hasher |
| [`02-login-tighten.md`](./02-login-tighten.md) | Mapper reads `sessionVersion`; Login/JWT carry it |
| [`03-middleware-session-version.md`](./03-middleware-session-version.md) | Middleware compares the stamp |
| [`04-request-command.md`](./04-request-command.md) | Use case calls `upsertByOwnerId` |
| [`05-complete-command.md`](./05-complete-command.md) | `$inc sessionVersion` + delete row |

## When to use this spec

Use this document to change **persistence + hasher only**. Login behaviour and reset HTTP stay as today.

| Artifact | This slice? |
|----------|-------------|
| Employee schema `sessionVersion: { type: Number, default: 0 }` | Yes |
| Employee entity / `toCreate` / `anonymize` / update-status `$set` | **No** — must not mention `sessionVersion` |
| Employees write/read mappers | **No** — omit the field (Mongo default on create) |
| `PasswordResetToken` schema + mapper + repository + spec | Yes |
| `HashResetTokenPort` + HMAC adapter + spec | Yes |
| `PASSWORD_RESET_PEPPER` on envs | Yes |
| Login / middleware / reset routes | **No** |
| Auth mapper `loginCapable` | **No** — slice 2 |

**Prompt sketch for the agent:**

> Implement slice 1 of password-reset following [`docs/specs/password-reset/01-persistence-seams.md`](./01-persistence-seams.md).  
> Add Employee schema `sessionVersion` default `0` (entity / `toCreate` / anonymize untouched). Add auth collection `PasswordResetToken` + mapper + repository. Add HMAC-SHA256 hasher with `PASSWORD_RESET_PEPPER` (not `EncrypterPort`). Unique `ownerId`.  
> Do not change Login, middleware, or add password-reset routes.

## 1. Employee schema

File: `src/modules/employees/infrastructure/outbound/persistence/employee.schema.ts`.

```ts
sessionVersion: { type: Number, default: 0 }
```

Rules:

1. Do **not** add `sessionVersion` to `Employee` props, `EmployeeModel.toCreate`, `anonymize()`, or employees glossary / `CONTEXT.md`.
2. `updateStatus` `$set` stays `{ status, deactivateAt }` only.
3. `anonymize` `$set` stays the existing PII/status/password/`removedAt` fields only.
4. `mapEmployeeDocument` / `mapToCreateDocument` / `mapEmployeeReadModel` **omit** `sessionVersion`. Create lets Mongo default to `0`.
5. If TypeScript’s `EmployeeDocument` now requires the field on `mapToCreateDocument`’s return type, **do not** put it on `toCreate`. Loosen the create payload type or omit the field and satisfy the compiler without a full-document write of `0` on update/anonymize.

A future full-document Employee replace that writes `sessionVersion: 0` would resurrect old JWTs ([ADR 0008](../../adr/password-reset/0008-session-version-invalidates-jwts.md)).

Existing employees repository / auth adapter fixtures that `as EmployeeDocument`: leave them; optional compile seam `sessionVersion: 0` on a lean mock is OK if inference demands it.

## 2. Reset Token write model (auth)

Not an employees concept. Suggested type: `domain/models/password-reset-token.model.ts` (snapshot type, **not** an entity).

| Field | Rule |
|-------|------|
| `ownerId` | Authenticatable id (Employee `_id` as string). **Unique**. |
| `tokenHash` | HMAC-SHA256 hex (or equivalent stable digest). Indexed unique. |
| `issuedAt` | Cooldown clock (15 minutes) — slice 4. |
| `expiresAt` | TTL 30 minutes — slice 5 rejects if `expiresAt <= now`. |

Raw secret is never persisted. Consume = **delete** the row (slice 5).

Optional Mongo TTL index `expireAfterSeconds: 0` on `expiresAt` is cleanup only ([design §17 Q5](../../design-docs/password-reset-v1.md)). **App check is mandatory** in slice 5 even if the index exists.

## 3. Repository (normative)

Files under `src/modules/auth/infrastructure/outbound/persistence/`:

- `password-reset-token.schema.ts`
- `password-reset-token.mapper.ts`
- `password-reset-token-mongoose.repository.ts` + `*.spec.ts`

Indexes: unique `ownerId`; unique `tokenHash`.

| Method | Behaviour |
|--------|-----------|
| `findByOwnerId(ownerId)` | Outstanding row or `null` |
| `findByTokenHash(tokenHash)` | Outstanding row or `null` |
| `upsertByOwnerId({ ownerId, tokenHash, issuedAt, expiresAt })` | Replace hash + timestamps (last wins). One row per owner. |
| `deleteByOwnerId(ownerId)` | Consume; no-op if missing |

Application outbound ports for these methods may be declared in this slice (so the repo can implement them) or in slice 4 — **do not duplicate** the port files later.

Do not add HTTP. Do not call the hasher from the repository (it stores the hash it is given).

## 4. HMAC hasher (normative)

**Not** `EncrypterPort` / bcrypt — lookup is by hash ([ADR 0010](../../adr/password-reset/0010-reset-token-hash-is-hmac-sha256.md)).

```ts
// application/ports/outbound/hash-reset-token.port.ts
export interface HashResetTokenPort {
  hash(raw: string): string
}
```

Adapter (auth outbound, e.g. `infrastructure/outbound/crypto/hmac-reset-token-hasher.ts`):

- `createHmac('sha256', pepper).update(raw).digest('hex')` (Node `crypto`).
- Pepper from `PASSWORD_RESET_PEPPER` via `@configs/envs` (`passwordResetPepper`).
- Missing pepper → throw (do **not** fall back to `JWT_SECRET`).
- Deterministic: same raw + pepper → same digest (complete looks up by hash).

## Files

| File | Action |
|------|--------|
| `employees/.../employee.schema.ts` | Add `sessionVersion` default `0` |
| Employees entity / `toCreate` / mappers / anonymize / update-status | Do not add the field |
| `auth/domain/models/password-reset-token.model.ts` | Create (snapshot type) |
| `auth/infrastructure/outbound/persistence/password-reset-token.*` | Schema, mapper, repository + spec |
| `auth/application/ports/outbound/hash-reset-token.port.ts` | Create |
| `auth/infrastructure/outbound/crypto/hmac-reset-token-hasher.ts` + spec | Create |
| `src/configs/envs/index.ts` | `passwordResetPepper` |
| Login / middleware / routes / `app.ts` | Do not change |

## Spec expectations

### `password-reset-token-mongoose.repository.spec.ts`

Same `makeChainableMock` style as `employee-auth.adapter.spec.ts` / employees repo. No real Mongo required.

| `it(...)` | Assert |
|-----------|--------|
| `findByOwnerId` queries `{ ownerId }` and maps a hit | row or fields |
| `findByOwnerId` miss | `null` |
| `findByTokenHash` queries `{ tokenHash }` | hit / miss |
| `upsertByOwnerId` updates one filter `{ ownerId }` with hash + `issuedAt` + `expiresAt` (upsert) | last-wins payload |
| `deleteByOwnerId` deletes `{ ownerId }` | called |

### `hmac-reset-token-hasher.spec.ts`

Stub envs (`passwordResetPepper: 'test-pepper'`).

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | instance |
| `should return a hex digest` | `/^[0-9a-f]+$/i`, length 64 for SHA-256 |
| `should be deterministic` | `hash('raw')` equals `hash('raw')` |
| `should differ when raw differs` | `'a'` ≠ `'b'` |
| `should throw if PASSWORD_RESET_PEPPER is not set` | no JWT fallback |
| `should not equal sha256-without-hmac of the raw token` | pepper matters (optional but useful) |

Do not persist or log the raw token in assertions beyond the input of `hash`.

## Checklist (agent)

- [ ] Employee schema has `sessionVersion` default `0`
- [ ] Employees entity / `toCreate` / anonymize / update-status `$set` untouched
- [ ] Token collection is auth-owned; unique `ownerId`
- [ ] Hasher is HMAC-SHA256 + dedicated pepper
- [ ] Co-located repo + hasher specs pass
- [ ] Login still gates on `ACTIVE` (slice 2 changes that)
- [ ] No reset HTTP

## Out of scope

- `loginCapable` on the snapshot
- Middleware `findById`
- Request / complete use cases
- Mongo TTL index as a substitute for the app expiry check

## Acceptance criteria

- [ ] New Employee documents get `sessionVersion` `0` from the schema default without employees write snapshots mentioning the field
- [ ] `upsertByOwnerId` keeps a single row per owner
- [ ] `hash(raw)` is stable and does not use `EncrypterPort`
- [ ] Existing employees create / update-status / anonymize / list specs still pass
- [ ] Existing login specs still pass unchanged

## Reference map

| Concern | Look at |
|---------|---------|
| Employee schema today | `employee.schema.ts` |
| Auth adapter style | `employee-auth.adapter.ts` |
| Why a collection | [ADR 0007](../../adr/password-reset/0007-reset-token-lives-in-auth-collection.md) |
| Why schema-only stamp | [ADR 0008](../../adr/password-reset/0008-session-version-invalidates-jwts.md) |
| Why HMAC | [ADR 0010](../../adr/password-reset/0010-reset-token-hash-is-hmac-sha256.md) |
| Next slice | [`02-login-tighten.md`](./02-login-tighten.md) |
