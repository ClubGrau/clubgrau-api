# Last Admin cannot go on VACATION

Login rejects any status other than `ACTIVE`. There is no second `ACTIVE` ADMIN to restore the Last Admin, and a MANAGER cannot act on ADMINs. `VACATION` would lock the platform the same way `INACTIVE` would. Last Admin stays `ACTIVE` until another `ACTIVE` ADMIN exists. Leftover `INACTIVE` / `VACATION` ADMINs do not count as that second login. This version does not let `VACATION` users log in.
