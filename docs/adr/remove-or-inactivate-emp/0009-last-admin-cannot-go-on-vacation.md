# Last Admin cannot go on VACATION

**Status:** superseded by [0014](./0014-last-admin-is-login-capable.md)

This decision assumed login rejected any status other than `ACTIVE`. Under that premise, `VACATION` would lock the platform the same way `INACTIVE` would, so Last Admin could not take vacation.

That premise is false: `VACATION` is a full session (login, password reset, Actor). Last Admin **may** go on `VACATION`. Leftover `VACATION` ADMINs count as login-capable.
