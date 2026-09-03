# Reset Token lives in an auth-owned collection

The password hash stays on `Employee` ([ADR 0006](./0006-password-hash-stays-on-employee.md)). The Reset Token is a different aggregate: one-time, 30-minute TTL, 15-minute cooldown, last-wins after cooldown. Persisting those fields on the Employee document would make employees carry a flow it does not own. Redis would add infrastructure for a 30-minute secret while Mongo is already in the composition root. Auth therefore owns a Mongo collection (hash + `ownerId` + `issuedAt` + `expiresAt`) with a unique index on `ownerId`.
