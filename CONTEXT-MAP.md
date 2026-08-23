# Context Map

## Contexts

- [Employees](./src/modules/employees/CONTEXT.md) — collaborator identity and lifecycle on the platform
- Auth — authentication (login, JWT); references Employee by id; does not own lifecycle
- Customers — salon clients; independent of this flow

## Relationships

- **Employees → Auth**: Auth authenticates an `ACTIVE` Employee. Remove does not revoke JWTs. Auth should refuse a session whose current status is no longer `ACTIVE` (sibling concern; not this PRD).
- **Employees → other contexts**: other modules may store `employeeId`. That is why Remove is Anonymize (the id survives). What those modules do with a `REMOVED` id is **not** specified here — pending domain-expert decisions outside this document.
