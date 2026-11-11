# Customer remove is anonymization that keeps the id and the name

Removing a customer must keep the same `customerId`. Friend indications already store a `referrerCustomerId`, and sales will store the customer id. A hard delete would orphan those links. The document stays: `email` becomes the unique sentinel `removed.{id}@anonymized.invalid` (the original email is freed), `phone` and `nif` are erased, `removedAt` is set. `rank`, `indication`, and `createdAt` are kept.

Unlike employees, the **name is kept**. The id alone keeps the links whole, but the history of indications and sales must still say who the customer was. This was a deliberate trade-off: keeping the name does not fully satisfy a GDPR erasure request, which is the situation that triggers a removal. The risk was accepted by product.

A person who returns after removal is a new customer: new id, born Bronze, no indication or history inherited. Recognising them would require keeping the data they asked to erase.

## Considered options

- **Hard delete.** Rejected: orphans the Referrer link today and the sale link tomorrow.
- **Sentinel name, as employees do.** Rejected: the history would read "Removed customer" everywhere, which the salon does not want.
- **Sentinel name on the customer, copy of the name on each sale.** Deferred to the sales PRD. It does not cover indications.

## Consequences

- If GDPR compliance requires it later, the name can be shortened (e.g. "Maria S.") without touching the id or the links.
- Remove is terminal. There is no restore.
