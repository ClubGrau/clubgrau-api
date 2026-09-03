# PRD: Password Reset

**Product Requirements Document**
**Date:** 01/09/2026 | **Status:** Ready for Design Doc | **Version:** 1.0

**Glossary:** [`src/modules/auth/CONTEXT.md`](../../src/modules/auth/CONTEXT.md) · [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md) (login-capable, Last Admin)
**ADRs:** [`docs/adr/password-reset/`](../adr/password-reset/)
**Identity:** [`docs/auth-identity-tradeoff.md`](../auth-identity-tradeoff.md) (option B — hash stays on `Employee`)
**Lifecycle consequence:** [`docs/prd/employee-lifecycle-v1.md`](./employee-lifecycle-v1.md) v1.1 · [ADR 0014](../adr/remove-or-inactivate-emp/0014-last-admin-is-login-capable.md)

This document specifies **Password Reset**: a login-capable collaborator who does not know their password receives a link by email and sets a new one. It does **not** reveal the current password. It does **not** extract an Identity (`users`) module.

---

## 1. Overview and objective

Club Grau already authenticates collaborators with email + password (`POST /auth`). The password is a bcrypt hash (`Password` VO + `EncrypterPort`). Login today refuses anyone who is not `ACTIVE`. There is no path back in when the password is forgotten.

A mock for “Recuperação de Senha” showed the current password (masked, copyable), a generate-secure-password control, and a new-password form. Viewing the current password is impossible without storing plaintext or reversible encryption. That is rejected.

**Objective:** an unauthenticated **request** (email) plus a **complete** (Reset Token + new password) that replaces the hash. The person then logs in as today. `VACATION` is a full session, same as `ACTIVE`.

**Non-goals (this version):**

- Revealing, decrypting, or copying the current password
- Change-password while already authenticated (knows the old password)
- Hexagon `mail` / HTTP for sending email
- Extracting Identity (`users`); splitting the password off `Employee`
- Welcome, receipts, or any email template other than password-reset
- Auto-login after complete (no Session Token from the Reset Token)
- Revoking Session Tokens on Deactivate / Remove (still Auth sibling, not this feature)
- A generate-password endpoint on the API
- Customer (or any second authenticatable actor)
- Queue, retries dashboard, or template CMS

---

## 2. Business rules (core logic)

### Rule 2.1 — Reset is not reveal and not change

| Intent | Actor state | What they prove | Result |
|--------|-------------|-----------------|--------|
| **Password Reset** (this PRD) | not logged in | they received the email | new hash; old password useless |
| Reveal | — | — | **out of scope**; hash is one-way |
| Change (authenticated) | already has a Session Token | current password | **out of scope** this version |

The Vue screen **must not** include “senha actual” or copy-current-password. It may generate a strong password **in the browser** and/or let the person type one. Both paths submit the same complete body.

### Rule 2.2 — Only login-capable collaborators receive and complete a reset

**Login-capable** = `ACTIVE` | `VACATION` (employees glossary).

| State of the email | Request HTTP | Email sent? | Complete |
|--------------------|--------------|-------------|----------|
| `ACTIVE` or `VACATION` collaborator | same success | yes (unless cooldown) | allowed if token valid and still login-capable |
| `INACTIVE` | same success | no | token rejected (none issued) |
| `REMOVED` | same success | no | same |
| unknown email | same success | no | same |

Copy (product): “If this email exists, we sent a link.” Never distinguish “unknown” from “inactive” from “cooldown”. Same opacity as today’s `AuthenticationError` on login.

### Rule 2.3 — Login accepts VACATION

`POST /auth` succeeds for `ACTIVE` and `VACATION`. It refuses `INACTIVE` and `REMOVED` with the same opaque error as today.

`VACATION` is a full session: login, Password Reset, and Actor on lifecycle commands. Last Admin may go on vacation. See lifecycle PRD Rule 2.5 (v1.1) and ADR 0014.

### Rule 2.4 — Reset Token

- Opaque random secret. Persist only the **hash**, plus owner id, `expiresAt`, issued-at.
- TTL **30 minutes**.
- **One-time:** complete consumes it (delete or used flag). Reuse → opaque refusal (do not leak “already used” vs “unknown” vs “expired” if that would help an attacker; a generic “invalid or expired link” on the **complete** screen is allowed because the person already has the token).
- At most **one** outstanding token per collaborator.
- The raw token appears only in the email link (`https://<frontend>/reset-password?token=...`). The request response **never** returns the token.

### Rule 2.5 — Request cooldown (15 minutes)

A new request for an email that already received a Reset Token in the last **15 minutes**:

- still returns the same opaque success
- **does not** send another email
- **does not** invalidate the outstanding token

After 15 minutes, a new request **replaces** the previous token (last wins) and sends a new email — still only if login-capable.

This stops an attacker who knows the email from burning the victim’s link in a loop.

### Rule 2.6 — Complete does not issue a Session Token

Complete writes the new hash, consumes the token, and invalidates existing Session Tokens for that person (Rule 2.7). It returns success **without** a JWT.

The person uses “Voltar para o login”, then `POST /auth` with the new password. That is the only place a Session Token is born.

### Rule 2.7 — Existing sessions die on complete

After a successful complete, previously issued Session Tokens for that collaborator must fail (`401`) on authenticated routes. Stolen JWT or old password must not keep a session.

How (`passwordChangedAt`, token version, …) is a design-doc concern. **Not** in scope: revoking JWTs because of Deactivate or Remove.

### Rule 2.8 — New password mirrors Create

Complete body: `token`, `password`, `passwordConfirmation`.

- `password !== passwordConfirmation` → same `PasswordNotMatchError` as Create
- Strength → existing `Password` VO (`MIN_LENGTH` 8, upper, lower, digit, special). The mock’s “at least 8 characters” does **not** weaken the API
- Hash via `EncrypterPort` (bcrypt), then persist through the auth write adapter on `Employee` (option B)

Generate-secure-password is **frontend-only**. No domain service and no HTTP on `grau-api` that invents a password. The generated value fills both fields; the API treats it as a typed password.

### Rule 2.9 — Mailer is a port; Resend is the adapter

`MailerPort.send({ to, template, vars })` lives as a driven port (`@shared` or auth outbound). Infrastructure adapter talks to **Resend**. Tests use a fake.

- v1 template: `password-reset` only (link with raw Reset Token; no password in the body)
- `auth` is the only caller
- No `mail` hexagon, no mail HTTP API

### Rule 2.10 — Credentials stay on Employee

Auth does not import employees domain. A new outbound write port (e.g. replace password hash) is implemented by the same style of adapter that already reads `Employee` for login. Identity (`users`) is **not** extracted. Trade-off trigger 2 fired and was not paid.

---

## 3. Data contracts and dependencies

Unauthenticated. No JWT on request or complete.

**Request (planned):**

```http
POST /auth/password-reset
Content-Type: application/json

{ "email": "<email>" }
```

Success: `200` with a generic body (no token, no “sent” vs “not sent”). Always this shape for unknown / `INACTIVE` / `REMOVED` / cooldown.

**Complete (planned):**

```http
POST /auth/password-reset/complete
Content-Type: application/json

{
  "token": "<raw Reset Token from the link>",
  "password": "<new password>",
  "passwordConfirmation": "<same>"
}
```

Success: `200` with `{ id }` (or equivalent) of the collaborator — **no** Session Token.

**Login (change):**

```http
POST /auth
{ "email": "...", "password": "<new or existing>" }
```

Succeeds when status is `ACTIVE` or `VACATION`. Same opaque `401` otherwise.

**Frontend (grau-frontend, not this repo):** unauthenticated page from the email link. Controls: generate password locally **or** type + confirm; submit complete; link back to login. No current-password field.

**Employees:** owns the document that stores the hash; does not own the reset flow. Last Admin / Actor rules already updated in lifecycle v1.1.

**Env (design):** Resend API key; public frontend origin for the link; existing JWT secret / expiry for Session Tokens.

---

## 4. User stories

1. **As a login-capable collaborator:** I want to ask for a reset from the login screen so I can set a new password without knowing the old one.
2. **As a collaborator on `VACATION`:** I want the same login and reset as when `ACTIVE` — vacation is not a lockout.
3. **As a collaborator:** I want a 30-minute one-time link in email, and I do not want a second click two minutes later to kill that link.
4. **As a collaborator:** after I save the new password I want to log in with it; I do not want the email link to sign me in by itself.
5. **As a collaborator whose password leaked:** after I complete reset I want old Session Tokens to stop working.
6. **As the platform:** I do not want the request endpoint to tell anyone whether an email is registered or login-capable.

---

## 5. Edge cases

- **Request for unknown / `INACTIVE` / `REMOVED`:** opaque success; no email; no token.
- **Request inside 15-minute cooldown (login-capable):** opaque success; no new email; outstanding token unchanged.
- **Request after cooldown:** new token; previous outstanding token invalid; new email.
- **Complete with expired, unknown, reused, or cooldown-irrelevant bad token:** refuse; no hash write.
- **Complete while owner is no longer login-capable** (deactivated between send and click): refuse; token consumed or deleted so it cannot be retried after a Reactivate without a new request.
- **Complete with password policy failure or mismatch:** refuse; **do not** consume the token (person can fix the form and retry).
- **Generate on the client produces a value that fails `Password.create`:** API `400`; frontend must generate to the same policy or show the VO errors.
- **Stolen Reset Token used before the owner:** first complete wins; second fails; sessions of the real owner die — owner requests again.
- **Existing Session Token after complete:** `401` on authenticated routes.
- **`VACATION` JWT issued before this version:** remains valid until expiry unless complete runs (Rule 2.7) or a future status re-check rejects `INACTIVE` / `REMOVED`.

---

## 6. Interview analysis (how these rules were reached)

These scenarios were walked during the grilling session. They are the rationale, not extra product scope.

**Why not reveal.** Passwords are bcrypt. The mock’s “senha actual” would require plaintext or reversible crypto. Reset replaces the hash; it never returns the old secret.

**Why `VACATION` is login-capable.** Product: vacation is operational pause, not account lock. Login was `ACTIVE`-only; that would make reset-on-vacation a dead end. Login and reset both accept `ACTIVE` | `VACATION`. Last Admin may take vacation because they can still log in (ADR 0014). `INACTIVE` / `REMOVED` stay out.

**Why not extract `users`.** Recovery is trigger 2 in the identity trade-off. Paying it means a new hexagon, migration, and orchestrated Create. Reset only needs a write adapter next to the existing read adapter. Second authenticatable actor or 2FA still pays the debt.

**Why persist a hashed token, not a JWT in the link.** A signed link cannot be revoked on use or on a later request. A row (hash + expiry + owner) can.

**Why no auto-login.** The email link must not be enough to obtain a Session Token. Login remains the only issuer; the person proves they know the new password.

**Why kill sessions on complete, not on Deactivate.** Reset’s threat is a stolen password or JWT. Deactivate/Remove revocation stays a sibling so this PRD does not swallow lifecycle session policy.

**Why a 15-minute cooldown instead of last-wins always.** Unconditional replace lets an attacker who knows the email burn every link. Cooldown keeps one live token and the same opaque request response.

**Why generate on the frontend.** An unauthenticated “give me a password” endpoint puts a secret on the wire for no gain. `Password.create` is the policy; inventing the string is UI.

**Why `passwordConfirmation` on the API.** Same contract as Create. A client that skips the second field cannot persist a typo.

**Why Resend behind a port.** Sending email is not a product hexagon. Callers see `send(template)`; Resend is an adapter, replaceable in tests.

---

## 7. Acceptance criteria (minimum)

- [ ] `POST /auth/password-reset` with a login-capable email → `200` opaque; email contains a link with a token; token not in the HTTP body.
- [ ] Same request with unknown / `INACTIVE` / `REMOVED` → same `200`; no email.
- [ ] Second request within 15 minutes → same `200`; no second email; first token still valid.
- [ ] Complete with valid token + matching passwords that pass `Password` VO → new hash; token unusable; no JWT in the response.
- [ ] After complete, `POST /auth` with the **new** password succeeds for `ACTIVE` and for `VACATION`.
- [ ] After complete, `POST /auth` with the **old** password fails opaquely.
- [ ] After complete, a Session Token issued **before** complete is `401` on an authenticated route.
- [ ] Complete with mismatch or weak password → error; token still usable.
- [ ] Complete with expired / reused token → error; no write.
- [ ] Login with `VACATION` + correct password → `200` + Session Token (regression vs old `ACTIVE`-only check).
- [ ] Login with `INACTIVE` or `REMOVED` → same opaque `401` as unknown credentials.
- [ ] No current-password field is required or returned by the API.
- [ ] Mailer adapter can be faked in tests; production wiring is Resend; email body has the link, not the password.
