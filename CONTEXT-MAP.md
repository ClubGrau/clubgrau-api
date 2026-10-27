# Context Map

## Contexts

- [Employees](./src/modules/employees/CONTEXT.md) — collaborator identity and lifecycle on the platform
- Auth — authentication (login, JWT); references Employee by id; does not own lifecycle
- [Customers](./src/modules/customers/CONTEXT.md) — salon clients, their rank, and the indication that says where each came from
- [Indications](./src/modules/indications/CONTEXT.md) — catalog of the origins a customer can come from (Canal, Campanha, Amigo)

## Relationships

- **Indications → Customers**: Customers asks Indications, through its own outbound port, for an origin's category and whether it is active. The adapter lives in Indications. Customers never imports the Indications domain and keeps its own copy of the three category codes. Ending an origin does not change customers already linked to it.

- **Employees → Auth**: Auth authenticates an `ACTIVE` Employee. Remove does not revoke JWTs. Auth should refuse a session whose current status is no longer `ACTIVE` (sibling concern; not this PRD).
- **Employees → other contexts**: other modules may store `employeeId`. That is why Remove is Anonymize (the id survives). What those modules do with a `REMOVED` id is **not** specified here — pending domain-expert decisions outside this document.
