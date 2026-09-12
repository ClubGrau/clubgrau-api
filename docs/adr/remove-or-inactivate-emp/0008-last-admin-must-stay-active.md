# Last Admin must stay ACTIVE

**Status:** superseded by [0014](./0014-last-admin-is-login-capable.md)

After the authority matrix, a MANAGER cannot Reactivate an ADMIN. Login only accepted `ACTIVE`. If the last `ACTIVE` ADMIN became `INACTIVE` or `VACATION`, leftover non-`REMOVED` ADMINs would not restore login. That coupling of “login-capable = `ACTIVE` only” is what this ADR encoded.

Login now accepts `VACATION`. Last Admin must stay **login-capable** (`ACTIVE` | `VACATION`), not `ACTIVE`. They may go on vacation. They still cannot become `INACTIVE` while they are the only login-capable ADMIN. Remove still uses the last non-`REMOVED` ADMIN (legacy). ADR 0003 (cannot Remove) still holds.
