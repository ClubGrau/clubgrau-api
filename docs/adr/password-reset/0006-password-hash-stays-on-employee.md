# Password hash stays on Employee (Identity not extracted)

Password Reset fired trigger 2 in [`docs/auth-identity-tradeoff.md`](../../auth-identity-tradeoff.md) (“conta” as a business concept). Extracting a `users` hexagon now would mean a new module, a password migration, and orchestrated Create — for one extra write next to the existing login adapter. Auth gains a driven port to replace the hash; infrastructure still maps to the `Employee` collection. Pay the debt when a second authenticatable actor, lockout/2FA, or an IdP appears — not in this v1.
