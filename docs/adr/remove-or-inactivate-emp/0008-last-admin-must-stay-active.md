# Last Admin must stay ACTIVE

After the authority matrix, a MANAGER cannot Reactivate an ADMIN. Login only accepts `ACTIVE`. If the last `ACTIVE` ADMIN became `INACTIVE` or `VACATION`, leftover non-`REMOVED` ADMINs do not restore login — nobody could recover ADMIN access. Last Admin therefore cannot leave `ACTIVE` until another `ACTIVE` ADMIN exists. Remove still uses the last non-`REMOVED` ADMIN (legacy). ADR 0003 (cannot Remove) still holds; 0009 covers VACATION.
