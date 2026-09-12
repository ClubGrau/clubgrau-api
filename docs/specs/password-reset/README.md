# Specs: Password Reset (v1)

> Implementation contracts for the slices in design-doc §14.  
> Design: [`docs/design-docs/password-reset-v1.md`](../../design-docs/password-reset-v1.md).  
> PRD: [`docs/prd/password-reset-v1.md`](../../prd/password-reset-v1.md).  
> Glossary: [`src/modules/auth/CONTEXT.md`](../../../src/modules/auth/CONTEXT.md) · [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md) (login-capable).  
> ADRs: [`docs/adr/password-reset/`](../../adr/password-reset/).  
> Identity: [`docs/auth-identity-tradeoff.md`](../../auth-identity-tradeoff.md) (option B — hash stays on `Employee`).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md).  
> Hexagon: `src/modules/auth/` — living `AGENT.md` is created in slice 6.

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP/use-case work into an earlier slice. Do not merge request and complete into one spec.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-mailer-seam.md`](./00-mailer-seam.md) | `MailerPort` in `@shared`; Resend adapter + fake |
| 1 | [`01-persistence-seams.md`](./01-persistence-seams.md) | Employee `sessionVersion`; `PasswordResetToken` collection; HMAC hasher |
| 2 | [`02-login-tighten.md`](./02-login-tighten.md) | `loginCapable` + `sessionVersion` on snapshot / JWT; Login accepts `VACATION` |
| 3 | [`03-middleware-session-version.md`](./03-middleware-session-version.md) | Async middleware compares `sessionVersion` after decode |
| 4 | [`04-request-command.md`](./04-request-command.md) | `POST /auth/password-reset` (send-then-persist, opaque `200`) |
| 5 | [`05-complete-command.md`](./05-complete-command.md) | `POST /auth/password-reset/complete` (hash replace, consume, `$inc`) |
| 6 | [`06-contract.md`](./06-contract.md) | `auth.http` + living `auth/AGENT.md` |

**Dependencies:** slice 4 needs 0 + 1. Slice 5 needs 1 + 2 + 3 (so “old JWT dies” is testable). Slice 2 does not need 0.

**Lifecycle sibling (not these slices):** after JWT decode, re-check live employee status so `INACTIVE` / `REMOVED` cannot keep using the API. Document it in slice 6; do not implement it here. This feature only kills Session Tokens on **complete** via `sessionVersion`.

Use the auth glossary. Do not invent parallel terms (Password Reset / Reset Token / Session Token / Request / Complete). **Login-capable** is employees language; auth consumes a boolean from the adapter. `sessionVersion` is a persistence/JWT stamp — do not call it a token and do not put it on the `Employee` entity or glossary.
