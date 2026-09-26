# Specs: Update Professional Employee Data (v1)

> Implementation contracts for the slices in design-doc §13.  
> Design: [`docs/design-docs/update-professional-employee-data-v1.md`](../../design-docs/update-professional-employee-data-v1.md).  
> PRD: [`docs/prd/update-professional-employee-data-v1.md`](../../prd/update-professional-employee-data-v1.md).  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> ADRs: [`docs/adr/update-professional-employee-data/`](../../adr/update-professional-employee-data/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP/use-case work into an earlier slice.

`adaptRoute` already stamps `actorId`. `forbidden` / `conflict` helpers already exist. No infra-shared slice. No schema migration.

| Slice | Spec | Jira | Ships |
|-------|------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | TBD | `changeJobTitle`; professional forbidden + empty errors; `CountLoginCapableAdminsPort` (interface only); `EmployeeProfessionalDataPolicy`; `EmployeeProfessionalDataPatchService` |
| 1 | [`01-persistence.md`](./01-persistence.md) | TBD | `countLoginCapableAdmins` (`ACTIVE \| VACATION`); `UpdateProfessionalEmployeeDataRepositoryPort` + `updateProfessionalData` `$set` of present keys |
| 2 | [`02-usecase.md`](./02-usecase.md) | TBD | `resolveProfessionalEmployeeDataChanges` + snapshot `jobTitle` + `UpdateProfessionalEmployeeDataUsecase` |
| 3 | [`03-http-and-contract.md`](./03-http-and-contract.md) | TBD | `PATCH /employee/:id/professional-data` + wiring + `.http` + living `AGENT.md` |

**Dependencies:** `1` does not need `2`. `2` needs `0` + `1`. `3` needs `2`. Do not merge `2` and `3` into one spec.

Use the glossary. Do not invent parallel terms (Edit Collaborator / Professional Employee Data / Update Professional Employee Data / Job Title / Role / Employment Id / Actor / Target / Removed / Login-capable / Last Admin). Do not call this command update employee, update profile, or Edit Collaborator.

`EmployeeProfessionalDataPolicy` and `EmployeeProfessionalDataPatchService` are implementation names, not glossary terms.

**Out of these slices:** Get-by-id; Main / Personal sections; writing `employmentId`; self-service; `password`; replacing `POST /api/employee/update-status`; widening `EmployeeLifecyclePolicy` Actor to login-capable; widening `countActiveAdmins`; revoking Session Tokens after Role / Status change.
