# Last Admin is login-capable, not ACTIVE-only

Login and password reset accept `ACTIVE` and `VACATION`. `VACATION` is a full session, including Actor on Remove / update-status. Last Admin is therefore the only ADMIN whose status is login-capable (`ACTIVE` | `VACATION`), not the only `ACTIVE` ADMIN.

They **may** go on `VACATION` even when they are the Last Admin — they can still log in. They **must not** become `INACTIVE` while they are the only login-capable ADMIN: leftover `INACTIVE` ADMINs do not restore login, and a MANAGER cannot Reactivate an ADMIN. Remove still protects the last non-`REMOVED` ADMIN (ADR 0003).

**Considered options:** keep “Last Admin cannot take vacation” as a floor-policy even after login opened. Rejected: the user asked for no extra rules on `VACATION`; the old lockout rationale no longer applies.

Supersedes [0008](./0008-last-admin-must-stay-active.md) and [0009](./0009-last-admin-cannot-go-on-vacation.md).
