# Specs: Employee Lifecycle (v1)

> Implementation contracts for the slices in design-doc §14.  
> Design: [`docs/design-docs/employee-lifecycle-v1.md`](../../design-docs/employee-lifecycle-v1.md).  
> PRD: [`docs/prd/employee-lifecycle-v1.md`](../../prd/employee-lifecycle-v1.md).  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> ADRs: [`docs/adr/remove-or-inactivate-emp/`](../../adr/remove-or-inactivate-emp/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP/use-case work into an earlier slice.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-adapt-route-and-http-helpers.md`](./00-adapt-route-and-http-helpers.md) | `adaptRoute` stamps `actorId`; `forbidden` / `conflict` helpers |
| 1 | [`01-domain.md`](./01-domain.md) | `REMOVED`, `isOperationalStatus`, errors, `anonymize()`, `EmployeeLifecyclePolicy` |
| 2 | [`02-persistence.md`](./02-persistence.md) | schema `removedAt` + enum; repo count / anonymize / list exclusion |
| 3 | [`03-update-employee-status.md`](./03-update-employee-status.md) | tighten `UpdateEmployeeStatus` (actor + policy + HTTP map) |
| 4 | [`04-remove-employee.md`](./04-remove-employee.md) | `RemoveEmployee` vertical slice |
| 5 | [`05-list-and-module-contract.md`](./05-list-and-module-contract.md) | list `isOperationalStatus`; living `AGENT.md` |

**Auth follow-up (not these slices):** re-check current employee status after JWT decode so `INACTIVE` / `REMOVED` / `VACATION` cannot keep using the API. Document it in slice 5; do not implement it here.

Use the glossary. Do not invent parallel terms (Deactivate / Reactivate / Remove / Anonymize / Actor / Target / Removed / Last Admin).
