# Employee remove is anonymization, not hard delete

Removing a collaborator from the platform must keep the same `employeeId`. Other contexts may already — or later — store records keyed by that id. Hard delete was rejected: it would orphan those references. The document remains; personal data is replaced with sentinels; `status` becomes terminal `REMOVED`; the original email is freed for a new Create.

Reactivate stays a separate command (`update-status` → `ACTIVE`). Remove is only offered from `INACTIVE`.

This decision does **not** specify any downstream module (payroll, commissions, or otherwise). It only constrains Employees: the id must survive.
