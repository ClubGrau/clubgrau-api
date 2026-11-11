# A removed customer is marked by `removedAt`, not by a status

Customers have no status field. Inactivity will be **computed** from the date of the last paid order, by rules the domain experts will define. Removal would be the only stored state.

`removedAt: Date | null` marks it. `null` means not removed. The date records when the erasure happened. No `removedBy` is stored.

## Considered options

- **A `status` field with `REMOVED`**, as employees do ([employee ADR 0013](../remove-or-inactivate-emp/0013-removed-is-a-status-enum-value.md)). Rejected: a one-value enum invites someone to store `INACTIVE` next to it, which would clash with the computed inactivity.
- **Detect removal from the email sentinel.** Rejected: implicit and fragile.

## Consequences

- Every read that must hide removed customers filters `removedAt: null`.
- Future rank and inactivity rules work over customers with `removedAt: null` and treat removed ones separately.
