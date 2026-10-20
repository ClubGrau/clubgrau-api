# Rank is stored, born Bronze, and nothing changes it yet

A customer holds its rank as stored data (`BRONZE`, `SILVER`, or `GOLD`) and is always created as `BRONZE`. The rank is never an input: a `rank` in the create body is not forwarded. No method, use case, job, or endpoint changes a rank in this version, and the entity has no promote method.

The climb rule is still being defined with the domain expert, and the API has no history (visits, spend) to compute a rank from. A stored rank is the smallest truthful model and keeps the entity ready for a later PRD to add the transition. Computing the rank on read was rejected because there is nothing to compute it from. A manual endpoint was rejected because it would let the floor invent a ladder before the rule exists.

The contract values are English, like roles. The frontend owns the Portuguese labels (Bronze, Prata, Ouro).

## Consequences

The rank is stored on the customer document, so replacing it with a computed value later needs a data decision, not only a code change. A later PRD that adds a transition must also decide what happens to ranks already stored.
