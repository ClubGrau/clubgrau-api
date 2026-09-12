# Specs: Update Main Employee Data (v1)

> Implementation contracts for the slices in design-doc §13.  
> Design: [`docs/design-docs/update-main-employee-data-v1.md`](../../design-docs/update-main-employee-data-v1.md).  
> PRD: [`docs/prd/update-employee-v1.md`](../../prd/update-employee-v1.md).  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> ADRs: [`docs/adr/update-main-employee-data/`](../../adr/update-main-employee-data/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP/use-case work into an earlier slice.

`adaptRoute` already stamps `actorId`. `forbidden` / `conflict` helpers already exist. No infra-shared slice.

| Slice | Spec | Jira | Ships |
|-------|------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | [KAN-21](https://paulodevmais.atlassian.net/browse/KAN-21) | `changeUsername`; `EmployeeMainDataForbiddenError`; `EmployeeMainDataPolicy.assertCan` |
| 1 | [`01-persistence.md`](./01-persistence.md) | [KAN-22](https://paulodevmais.atlassian.net/browse/KAN-22) | `UpdateMainEmployeeDataRepositoryPort` + `updateMainData` `$set` of present keys |
| 2 | [`02-usecase.md`](./02-usecase.md) | [KAN-23](https://paulodevmais.atlassian.net/browse/KAN-23) | `UpdateMainEmployeeDataUsecase` (policy + occupancy skip + mutators + persist patch) |
| 3 | [`03-http-and-contract.md`](./03-http-and-contract.md) | [KAN-24](https://paulodevmais.atlassian.net/browse/KAN-24) | `PATCH /employee/:id/main-data` + wiring + `.http` + living `AGENT.md` |

**Dependencies:** `1` does not need `2`. `2` needs `0` + `1`. `3` needs `2`. Do not merge `2` and `3` into one spec.

Use the glossary. Do not invent parallel terms (Edit Collaborator / Main Employee Data / Update Main Employee Data / Email occupancy / Actor / Target / Removed / Login-capable). Do not call this command update employee, update profile, or Edit Collaborator.

**Auth follow-up (not these slices):** revoke Session Tokens when email changes. Same leftover-JWT gap as Deactivate. Document it in slice 3; do not implement it here. Do not change `EmployeeLifecyclePolicy` Actor from `ACTIVE` to login-capable.
