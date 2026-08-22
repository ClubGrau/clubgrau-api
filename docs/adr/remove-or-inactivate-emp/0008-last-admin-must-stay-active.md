# Last Admin must stay ACTIVE

After the authority matrix, a MANAGER cannot Reactivate an ADMIN. Login only accepts `ACTIVE`. If the last non-`REMOVED` ADMIN became `INACTIVE`, nobody could restore ADMIN access. Last Admin therefore cannot be Deactivated or Removed; they stay `ACTIVE` until another ADMIN exists. ADR 0003 (cannot Remove) still holds; 0009 covers VACATION.
