# ADMIN and MANAGER may remove a customer

Remove is irreversible, so it is not open to every authenticated employee, as create and list are. The route uses `requireRoles('ADMIN', 'MANAGER')`. An `EMPLOYEE` gets `403`.

This differs from employees, where only `ADMIN` removes ([employee ADR 0002](../remove-or-inactivate-emp/0002-only-admin-may-remove.md)). The customer base is operational data that a manager runs day to day. The password confirmation ([ADR 0003](0003-actor-password-is-verified-through-a-port-implemented-by-auth.md)) compensates for the wider authority.

## Considered options

- **ADMIN only.** Rejected: a manager owns the customer base.
- **Any authenticated employee.** Rejected: too wide for an action that cannot be undone.
