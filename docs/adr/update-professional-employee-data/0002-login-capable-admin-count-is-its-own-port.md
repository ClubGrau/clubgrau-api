# Login-capable ADMIN count is its own port

Leaving the `ADMIN` role must refuse when the Target is the last login-capable ADMIN (`ACTIVE` | `VACATION`) or the last non-`REMOVED` ADMIN. `countActiveAdmins` is ACTIVE-only: a lone ADMIN on `VACATION` would pass (`count === 0`), and a `VACATION`+`ACTIVE` pair would fail on the wrong person (`count === 1`).

We added `CountLoginCapableAdminsPort` and kept `countActiveAdmins` untouched. Deactivate still uses the ACTIVE-only count until its own follow-up. `countNonRemovedAdmins` stays the second barrier.

Rejected: widening `countActiveAdmins` (would silently change Deactivate) and counting ADMINs in the use case (the invariant belongs in the professional policy).
