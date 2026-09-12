# Spec: Slice 0 — Mailer seam (`MailerPort` + Resend + fake)

> Shared outbound mail I/O used by later password-reset slices.  
> Parent: [`README.md`](./README.md).  
> Design §11 / [ADR 0003](../../adr/password-reset/0003-mailer-is-a-port-resend-is-the-adapter.md) / [ADR 0009](../../adr/password-reset/0009-mailer-port-lives-in-shared.md).  
> Next: [`01-persistence-seams.md`](./01-persistence-seams.md).

## Responsibility (this spec only)

Add `MailerPort` next to `EncrypterPort`, a Resend adapter that reads env, and an in-memory fake for specs. Auth does **not** call mail yet.

| Spec | Responsibility |
|------|----------------|
| **This file** | Port + Resend adapter + fake + env keys the adapter needs |
| [`04-request-command.md`](./04-request-command.md) | Auth use case calls `MailerPort.send` |
| [`06-contract.md`](./06-contract.md) | Documents the port on the auth contract |
| Hexagon `mail` / Resend dashboard CMS | **Never** this feature |

## When to use this spec

Use this document to add the shared mail seam **before** request HTTP exists.

| Artifact | This slice? |
|----------|-------------|
| `MailerPort` in `@shared/application/ports` | Yes |
| Resend adapter + co-located spec | Yes |
| In-memory fake that records calls | Yes |
| `RESEND_API_KEY` / `RESEND_FROM` on `src/configs/envs` | Yes — adapter constructor / send reads them |
| `makeAuthModule` / auth use cases / routes | **No** |
| Employee schema / Reset Token collection | **No** |
| Instantiating the adapter in `app.ts` and passing it into auth | **No** — slice 4 |

**Prompt sketch for the agent:**

> Implement slice 0 of password-reset following [`docs/specs/password-reset/00-mailer-seam.md`](./00-mailer-seam.md).  
> Add `MailerPort.send({ to, template, vars })` in `@shared/application/ports` and a Resend adapter with an in-memory fake. Template union is `'password-reset'` only.  
> Do not mount routes or call Resend from auth yet.

## Port (normative)

File: `src/shared/application/ports/mailer.port.ts` (same folder as `encrypter.port.ts`).

```ts
export type MailTemplate = 'password-reset' // widen later; do not invent templates in v1

export interface MailerPort {
  send(input: {
    to: string
    template: MailTemplate
    vars: Record<string, string>
  }): Promise<void>
}
```

Rules:

1. v1 template is `'password-reset'` only. An unknown `template` **throws** (do not silently no-op — widening the union must be explicit).
2. Vars for `password-reset`: **`resetUrl` only**. The adapter must not put a password in the message even if a caller smuggles extra keys on `vars`.
3. Auth is the only caller in this version. Do not import auth types into `@shared`.
4. Do not add HTTP, queues, retries dashboard, or a `mail` hexagon.

## Resend adapter (normative)

Folder: `src/shared/infrastructure/adapters/resend/` (mirror `bcrypt/`).

- Read `RESEND_API_KEY` and `RESEND_FROM` from `@configs/envs` (add the keys). Do **not** hardcode a from-address ([design §17 Q2](../../design-docs/password-reset-v1.md)).
- Missing key at send/construct time: throw a clear error (same spirit as `JWT_SECRET is not set`).
- Compose a **minimal** body that includes `vars.resetUrl` and does not include a password ([design §17 Q3](../../design-docs/password-reset-v1.md)). Product copy language is out of this API’s glossary; the link is enough.
- Do not call the live Resend API from the unit spec — mock the SDK.

Coverage already excludes `*.adapter.ts`. The spec still **runs**; do not move send logic into a covered wrapper to “fix coverage”.

## Fake (normative)

In-memory / no-op for specs. Record `{ to, template, vars }` in call order. Support a test hook to reject the next `send` (slice 4 needs “mail fail → still `{ ok: true }`”).

Suggested name: `InMemoryMailer` or `MailerFake`. Live next to the adapter (or under a `fake` file in the same folder). Do not put the fake inside the auth hexagon.

## Env

`src/configs/envs/index.ts`:

| Key | Env var |
|-----|---------|
| `resendApiKey` | `RESEND_API_KEY` |
| `resendFrom` | `RESEND_FROM` |

Do not add `FRONTEND_PUBLIC_ORIGIN` or `PASSWORD_RESET_PEPPER` here (slices 4 and 1).

## Files

| File | Action |
|------|--------|
| `src/shared/application/ports/mailer.port.ts` | Create |
| `src/shared/infrastructure/adapters/resend/resend-mailer.adapter.ts` | Create |
| `src/shared/infrastructure/adapters/resend/resend-mailer.adapter.spec.ts` | Create |
| `src/shared/infrastructure/adapters/resend/in-memory-mailer.ts` (or equivalent fake) | Create |
| `src/configs/envs/index.ts` | Add Resend keys |
| Auth / employees / `app.ts` / routes | Do not change |

## Spec expectations

### `resend-mailer.adapter.spec.ts`

Mock the Resend SDK. Stub envs (`resendApiKey`, `resendFrom`).

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | adapter instance |
| `should send password-reset with resetUrl in the body` | SDK called; body/html/text contains the `resetUrl` value |
| `should use RESEND_FROM as from` | from equals the env value, not a hardcoded address |
| `should not put a password in the message` | even if `vars` has `password` / `token`, those strings are absent from the body |
| `should throw on unknown template` | e.g. cast `'welcome'` → throw; SDK not called |
| `should throw if RESEND_API_KEY is missing` | same pattern as JWT adapter |
| `should throw if RESEND_FROM is missing` | same |

Do not hit the network.

### Fake (cover in the adapter spec or a tiny `in-memory-mailer.spec.ts`)

| `it(...)` | Assert |
|-----------|--------|
| `should record send calls` | `calls[0]` matches `{ to, template, vars }` |
| `should reject when configured to fail` | next `send` rejects; subsequent calls can succeed again |

## Checklist (agent)

- [ ] Port lives in `@shared/application/ports`, not under `auth/`
- [ ] Template union is `'password-reset'` only
- [ ] Adapter reads env; no hardcoded from
- [ ] Body has the link, not the password
- [ ] Fake records calls and can fail on demand
- [ ] Co-located specs pass without network
- [ ] No auth / employees / `app.ts` / HTTP edits

## Out of scope

- `RequestPasswordResetUsecase` / `MailerPort.send` from auth
- `app.ts` `new ResendMailerAdapter()` into `makeAuthModule`
- Welcome / receipt templates
- HTML CMS / Resend dashboard template id (swap later without changing the port)

## Acceptance criteria

- [ ] `MailerPort.send` is callable with `{ to, template: 'password-reset', vars: { resetUrl } }`
- [ ] Fake records that call; production adapter is Resend
- [ ] Email body (adapter) contains `resetUrl` and not a password
- [ ] Auth sources unchanged; existing auth/employees specs still pass

## Reference map

| Concern | Look at |
|---------|---------|
| Port neighbour | `src/shared/application/ports/encrypter.port.ts` |
| Adapter neighbour | `src/shared/infrastructure/adapters/bcrypt/bcrypt.adapter.ts` |
| Why `@shared` | [ADR 0009](../../adr/password-reset/0009-mailer-port-lives-in-shared.md) |
| Why Resend behind a port | [ADR 0003](../../adr/password-reset/0003-mailer-is-a-port-resend-is-the-adapter.md) |
| Next slice | [`01-persistence-seams.md`](./01-persistence-seams.md) |
