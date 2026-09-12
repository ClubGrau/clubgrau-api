# Auth

Authentication of a login-capable collaborator. This context issues and verifies the session; it does not own the employee record. Credentials today live on `Employee` and are reached through an adapter.

## Language

**Password Reset**:
Replacement of the password hash after the person proves they received a Reset Token. It does not reveal the old password and does not issue a Session Token.
_Avoid_: recuperação, reveal, ver senha actual, auto-login

**Reset Token**:
One-time secret sent in the email link. Stored as a hash with a 30-minute expiry. At most one outstanding token per person. A request inside the 15-minute cooldown neither issues a new token nor invalidates the current one. A request after the cooldown replaces the previous token. Consumed when the new password is saved. Never a Session Token.
_Avoid_: JWT, session, access token, magic link that logs in

**Session Token**:
JWT issued only by Login after email + new (or existing) password succeed. Used as `Authorization` on authenticated routes.
_Avoid_: Reset Token, definitive token as a third kind of credential
