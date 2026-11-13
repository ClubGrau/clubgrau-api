# A removed customer leaves the customer base but stays in the history

Once removed, a customer is out of the operational base and still present in the history.

**Out of the base:**

- `GET /api/customers` filters `removedAt: null` in the items, the `total`, and the search.
- A create with `amigo` cannot point at a removed customer. The referrer check answers "not referrable" for a removed customer, which is refused as an unknown referrer (`400`).

**In the history:**

- The name lookup for Referrers (`FindCustomerNamesByIdsPort`) still returns removed customers and says so. The Friend indication in the listing gains `referrerRemoved: boolean`, so the frontend shows "Maria Silva (removed)" and offers no link to a customer it cannot open.
- The removed customer's own `indication`, `createdAt`, and `rank` stay, so channel, campaign, and referral numbers do not change after the fact.

## Considered options

- **No flag on the Referrer.** Rejected: the receptionist reads a name, looks for the customer, and does not find it.
- **Hide the Referrer name entirely.** Rejected by [ADR 0001](0001-customer-remove-is-anonymization-keeping-the-name.md): the name is kept for the history.
- **A distinct error for a removed referrer.** Rejected: the picker never offers a removed customer, so the case only reaches the API from outside the screen.

## Consequences

The change to the listing is additive. Canal and Campanha indications are unchanged.
