# Spec: Slice 6 — Contract (`auth.http` + living `AGENT.md`)

> Close the HTTP samples and write the auth hexagon contract so it matches shipped code.  
> Parent: [`README.md`](./README.md).  
> Depends on: slices [`00`](./00-mailer-seam.md)–[`05`](./05-complete-command.md).  
> Design §9 / §14 last row. Constitution: update `AGENT.md` on contract change.

## Responsibility (this spec only)

1. `src/client/auth.http` covers login + request + complete.
2. Create living `src/modules/auth/AGENT.md` (the file does not exist today).
3. Confirm `CONTEXT.md` still matches the glossary (no implementation leak: no HMAC, no `sessionVersion`, no Resend).
4. Record the lifecycle sibling (JWT **status** re-check); do **not** implement it.

| Spec | Responsibility |
|------|----------------|
| [`04`](./04-request-command.md) / [`05`](./05-complete-command.md) | Commands already shipped |
| **This file** | Manual client + module contract docs |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `src/client/auth.http` | Yes |
| `src/modules/auth/AGENT.md` | Yes — create |
| `src/modules/auth/CONTEXT.md` | Yes — **only** if a term leaked; otherwise confirm |
| New product rules / extra routes | **No** |
| Auth middleware status re-check | **No** — document only |
| Design / PRD / ADRs rewrite | **No** |

**Prompt sketch for the agent:**

> Implement slice 6 of password-reset following [`docs/specs/password-reset/06-contract.md`](./06-contract.md).  
> Update `src/client/auth.http` (login + request + complete). Write living `src/modules/auth/AGENT.md`. Confirm `CONTEXT.md` has no implementation leak.  
> Document the lifecycle sibling (status re-check after JWT decode) as follow-up; do not implement it.

## `auth.http`

File today is login-only. Extend with samples (no secrets, no real Reset Token committed). Use the same host style as `employee.http`.

Must include:

```http
### Login
POST http://localhost:3003/auth
Content-Type: application/json

{ "email": "...", "password": "..." }

### Request password reset (always 200 { ok: true })
POST http://localhost:3003/auth/password-reset
Content-Type: application/json

{ "email": "..." }

### Complete password reset (no JWT in the response)
POST http://localhost:3003/auth/password-reset/complete
Content-Type: application/json

{
  "token": "<raw token from the email link>",
  "password": "...",
  "passwordConfirmation": "..."
}
```

Optional comments (not executable secrets):

- Login `VACATION` succeeds; `INACTIVE` / `REMOVED` → opaque `401`
- Request unknown email → same `200`
- Complete success → `{ data: { id } }` only
- After complete, old `Authorization: Bearer` on an employees route → `401` Invalid token

Do **not** paste a live Reset Token or `PASSWORD_RESET_PEPPER`.

## `CONTEXT.md`

Keep the three glossary terms (Password Reset / Reset Token / Session Token).  
If anyone added `sessionVersion`, HMAC, Resend, or file paths — **remove them**. Those belong in `AGENT.md`.

## `AGENT.md` (living contract)

Create `src/modules/auth/AGENT.md` so a new agent can extend the hexagon from the file alone. Mirror the employees `AGENT.md` shape (purpose, when to update, module status, directory map) — **do not** treat it as a changelog.

Sections that must match **shipped** code after slices 0–5:

1. **Module status** — Login, request, complete, middleware `sessionVersion` check. Password Reset is Done, not “planned”.
2. **Directory map** — controllers, use cases, token collection, hasher, employee auth adapter methods, shared `MailerPort`.
3. **Domain** — `AuthenticatableUser` (`loginCapable`, `sessionVersion`); `TokenPayload` omits `passwordHash` / `loginCapable`; errors (`AuthenticationError`, `InvalidResetTokenError`, auth `PasswordNotMatchError`). Point at `CONTEXT.md` for language.
4. **Login** — gates on `loginCapable`; JWT includes `sessionVersion`; mapper is the only place that knows `'ACTIVE' \| 'VACATION'`.
5. **Request** — send-then-persist; cooldown 15 min; opaque `{ ok: true }`; `resetUrl` from `FRONTEND_PUBLIC_ORIGIN`; never returns the token.
6. **Complete** — `Password.create`; mismatch message; consume = delete; `$set` + `$inc`; `{ id }` no JWT; not login-capable deletes then same invalid-link error.
7. **HTTP / routes** — `POST /auth`, `POST /auth/password-reset`, `POST /auth/password-reset/complete`. Request/complete unauthenticated. Table from design §9.
8. **Persistence** — Employee schema `sessionVersion` default `0` (entity / `toCreate` / anonymize do not touch it). Auth collection `PasswordResetToken`. HMAC pepper ≠ `JWT_SECRET`.
9. **Wiring** — `makeAuthModule({ compareHash, encrypter, mailer })`; middleware `(decoder, findById)`.
10. **Sequences** — request, complete, login after complete, old JWT (design §13).
11. **Open decisions**
    - Email HTML vs Resend template id — adapter composes a minimal body (design §17 Q3).
    - Mongo TTL index on `expiresAt` — optional; app check is mandatory.
    - **Session after INACTIVE / REMOVED (and whether VACATION stays a full session at the middleware)** — Auth sibling: after decode, re-load and refuse statuses that must not keep using the API. **Do not implement in this feature.** Complete already kills tokens via `sessionVersion`.
    - Identity extraction (`users`) — still deferred (option B).

Do not duplicate ADR essays; link `docs/adr/password-reset/`.

## Auth follow-up (document only)

Add this open decision (and nowhere as a fake `TODO` in code):

> Auth sibling (employee-lifecycle): after `authTokenMiddleware` decodes the JWT and (now) compares `sessionVersion`, also refuse a live status that is not login-capable (`INACTIVE` / `REMOVED`) with opaque `401`. Product: deactivated / removed must not keep using the API. This password-reset feature does not implement that check. `VACATION` remains login-capable.

Do not edit the employees hexagon except if `AGENT.md` there still says “Login already refuses `status !== ACTIVE`” — then one sentence: Login now refuses `!loginCapable` (`ACTIVE` \| `VACATION`). Only do that if the sentence is still wrong; do not rewrite employees.

## Files

| File | Action |
|------|--------|
| `src/client/auth.http` | Login + request + complete |
| `src/modules/auth/AGENT.md` | Create living contract |
| `src/modules/auth/CONTEXT.md` | Confirm glossary-only |
| `src/modules/employees/AGENT.md` | Optional one-line Login gate correction |
| Design / PRD / ADRs / use cases | Do not rewrite product rules |

## Checklist (agent)

- [ ] `.http` has the three routes; no secrets
- [ ] `AGENT.md` describes shipped request + complete + `sessionVersion` middleware
- [ ] `CONTEXT.md` has no HMAC / Resend / `sessionVersion`
- [ ] Lifecycle status re-check is an open decision, not code
- [ ] No new module; no generate-password endpoint; no auto-login

## Out of scope

- Implementing JWT status re-check
- Vue page (`grau-frontend`)
- New templates / queue / Identity hexagon

## Acceptance criteria

- [ ] A reader can exercise login, request, and complete from `auth.http`
- [ ] `AGENT.md` can be followed without treating Password Reset as future work
- [ ] `CONTEXT.md` stays glossary
- [ ] Auth sources’ behaviour unchanged by this slice (docs + client only)

## Feature acceptance (all slices — smoke)

Mirrors design §18 / PRD §7 at the HTTP boundary. Confirm as behaviour in `AGENT.md`, not as a checklist dump in code:

- Request login-capable → `200` `{ ok: true }`; email has `resetUrl`; token not in HTTP
- Request unknown / `INACTIVE` / `REMOVED` → same `200`; no email
- Second request within 15 minutes → same `200`; no second email
- Resend failure → same `200`; previous token unchanged
- Complete valid → new hash; token unusable; no JWT
- After complete, login with **new** password works for `ACTIVE` and `VACATION`
- After complete, old password → opaque `401`
- After complete, pre-complete Session Token → `401` on an authenticated route
- Complete mismatch / weak → `400`; token still usable
- Complete expired / reused / unknown → `400` invalid-or-expired
- Complete after Deactivate → `400` same message; token deleted
- Login `VACATION` → `200` + Session Token
- Login `INACTIVE` / `REMOVED` → opaque `401`
- Mailer faked in tests; production is Resend; body has the link, not the password

## Reference map

| Concern | Look at |
|---------|---------|
| Employees contract shape | `src/modules/employees/AGENT.md` |
| Auth glossary | `src/modules/auth/CONTEXT.md` |
| HTTP table | design §9 |
| Sequences | design §13 |
| Constitution | `AGENTS.md` “update AGENT.md on contract change” |
