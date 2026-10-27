# Indication is an embedded value object owned by customers

The indication is a value object (`Indication`) inside `customers`, stored as an embedded sub-document on the customer, with two shapes: an origin shape (`canal` or `campanha` plus `originId`) and a friend shape (`amigo` plus `referrerCustomerId`). `Indication.create` refuses every incoherent combination (unknown category, a missing id, both ids, the id of the other shape), so an invalid indication cannot be built. A customer with no indication has no `indication` field at all.

`customers` cannot import `IndicationCategories` from `indications`, so the three codes `canal`, `campanha`, `amigo` are written again in `customers`. This is a deliberate copy. The codes are fixed by the catalog PRD and closed (ADR 0001 of the catalog), so drift is unlikely, and the copy is cheaper than moving them to `@shared/domain` and refactoring `indications` outside this feature.

Ids are stored as Mongo `ObjectId` (same type as the `_id` of origins and customers) so a later read can join collections. The category is stored with the link even for an origin shape, where it could be derived, because it is what tells the two shapes apart and it records what the operator chose.

## Considered options

- **Shared category codes in `@shared/domain`.** Rejected for now: it forces a refactor of `indications` that this PRD does not need.
- **A loose `{ categoryId, originId?, referrerCustomerId? }` validated in the use case.** Rejected: the entity would accept incoherent combinations and the rule would live outside the domain.
- **A separate `customer_indications` collection.** Rejected: it needs two writes on create, which weakens "all or nothing" without a transaction ([ADR 0003](0003-no-transaction-on-create-customer.md)).
- **String ids.** Rejected: easier to read in the database, but loses the native type for later joins.
