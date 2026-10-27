# Cross-module reads are composed in the query, through ports

When a read needs data that another module owns (for example the origin name next to a customer), the query composes it. The query reads its own rows, collects the foreign ids, asks the owning module through an outbound port that takes a batch of ids and returns a read model, and merges the answer into its own read-model DTO. We do not use Mongoose `ref` and `populate()`, and we do not use `$lookup` across modules.

The merge happens in `application/queries/`, never in the domain, and the result is a read model, not an entity: queries do not reconstitute entities (`AGENTS.md` rule 8). The provider module implements the port with an adapter, as in [ADR 0001](0001-customers-consult-origins-through-a-port-implemented-by-indications.md). When both sides live in the same module (a customer's referrer is another customer), the query uses that module's own read port.

The first user is the future customer read, which must show the origin name or the referrer name. The stored ids are `ObjectId`, so a later decision to join in the database stays possible.

## Considered options

- **`ref` and `populate()`, or `$lookup` on `origins`.** Rejected: `customers` would depend on the Mongoose model and schema of `indications`, and `populate` fails unless that model is registered on the same connection. It also bypasses the owner's ports and its rule for "active".
- **Store the name next to the indication at create time.** Rejected for origins: an origin name can be corrected, so the copy would go stale. The link is the id. The name is read live.

## Consequences

The provider module gains a batch read port, which the read PRD defines. A page costs two or three queries, with no N+1. What the query shows when a foreign id has no row is a decision for the read PRD. Origins are never deleted and customers are never removed, so a miss means a data error.
