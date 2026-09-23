# Specs: Update Personal Employee Data (v1)

> Implementation contracts for the slices in design-doc §13.  
> Design: [`docs/design-docs/update-personal-employee-data-v1.md`](../../design-docs/update-personal-employee-data-v1.md).  
> PRD: [`docs/prd/update-personal-employee-data-v1.md`](../../prd/update-personal-employee-data-v1.md).  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP/use-case work into an earlier slice.

`adaptRoute` already stamps `actorId`. `forbidden` / `conflict` helpers already exist. No infra-shared slice. No schema migration.

| Slice | Spec | Jira | Ships |
|-------|------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | TBD | `EmployeeModel.Gender`; `assignGender` / `assignLanguages` / `assignAddress` / `assignEmergencyContact`; personal-data errors; `EmployeePersonalDataPolicy`; `EmployeePersonalDataPatchService` |
| 1 | [`01-persistence.md`](./01-persistence.md) | TBD | `UpdatePersonalEmployeeDataRepositoryPort` + `updatePersonalData` `$set` of present keys (`nif` → `Number`) |
| 2 | [`02-usecase.md`](./02-usecase.md) | TBD | `resolvePersonalEmployeeDataChanges` + `UpdatePersonalEmployeeDataUsecase` |
| 3 | [`03-http-and-contract.md`](./03-http-and-contract.md) | TBD | `PATCH /employee/:id/personal-data` + wiring + `.http` + living `AGENT.md` |

**Dependencies:** `1` does not need `2`. `2` needs `0` + `1`. `3` needs `2`. Do not merge `2` and `3` into one spec.

Use the glossary. Do not invent parallel terms (Edit Collaborator / Personal Employee Data / Update Personal Employee Data / Actor / Target / Removed / Login-capable). Do not call this command update employee, update profile, or Edit Collaborator.

`EmployeePersonalDataPolicy` and `EmployeePersonalDataPatchService` are implementation names, not glossary terms.

**Out of these slices:** self-service (`EMPLOYEE` editing their own personal data — new command, new policy), professional section, `languages` schema migration, `emergencyContact` VO growth, revoking Session Tokens, and any change to `EmployeeMainDataPolicy` or `EmployeeLifecyclePolicy`.
