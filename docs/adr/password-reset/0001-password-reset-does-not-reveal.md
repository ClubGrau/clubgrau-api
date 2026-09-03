# Password Reset does not reveal the current password

The Vue mock showed “senha actual” (masked + copy) on a recovery screen. Credentials are bcrypt hashes (`Password` VO, `EncrypterPort`). Returning the current password would require plaintext or reversible encryption. Password Reset therefore **replaces** the hash after a Reset Token; it never reads or returns the old secret. Generate-or-type on the frontend is the only way a new password appears.
