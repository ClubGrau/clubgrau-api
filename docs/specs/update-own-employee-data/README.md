# Specs: Update Own Employee Data (v1)

> Implementation contracts for the slices in design-doc §13.  
> Design: [`docs/design-docs/update-own-employee-data-v1.md`](../../design-docs/update-own-employee-data-v1.md).  
> PRD: [`docs/prd/update-own-employee-data-v1.md`](../../prd/update-own-employee-data-v1.md).  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP, use-case, or query work into an earlier slice.

`adaptRoute` already stamps `actorId`. No infra-shared slice. No schema migration. No new module.

The Main Data username fix is a **prerequisite**, not an own-data slice. It restores the contract already written in [`docs/specs/update-main-employee-data/03-http-and-contract.md`](../update-main-employee-data/03-http-and-contract.md). Do not implement own HTTP while doing it. Do not import own-data types into that controller.

| Slice | Spec | Jira | Ships |
|-------|------|------|-------|
| P — Main username | Existing [`03-http-and-contract.md`](../update-main-employee-data/03-http-and-contract.md) | TBD | `UpdateMainEmployeeDataController`: blank `username` forwards `null`. Controller spec updated. `name` / `email` / `phone` stay `400`. `status` / `password` on that route stay `400` |
| 0 | [`00-domain.md`](./00-domain.md) | TBD | `EmptyOwnEmployeeDataError`; `EmployeeOwnDataPolicy.assertCan(status)`; `EmployeeOwnDataPatchService` |
| 1 | [`01-persistence.md`](./01-persistence.md) | TBD | `updateOwnData` one `$set` + `FindOwnEmployeePort.findOwnEmployee` |
| 2 | [`02-usecase.md`](./02-usecase.md) | TBD | `resolveOwnEmployeeDataChanges` + `UpdateOwnEmployeeDataUsecase` (returns `GetEmployeesItemDto`) |
| 3 | [`03-query.md`](./03-query.md) | TBD | `GetOwnEmployeeQuery` |
| 4 | [`04-http-and-contract.md`](./04-http-and-contract.md) | TBD | `GET` + `PATCH /employee/me` + wiring + `.http` + living `AGENT.md` |
| 5 | [`05-reissue-session-token.md`](./05-reissue-session-token.md) | TBD | Auth `ReissueSessionTokenUseCase`. PATCH that included `name` returns `{ data, token }`. Same `sessionVersion` |

**Dependencies:** P is independent and lands first. `1` does not need `2`. `2` needs `0` + `1`. `3` needs `0` + the read port from `1`, not `2`. `4` needs `2` + `3`. `5` needs `4`. Do not merge `2` and `4`. Do not merge `3` and `4`. Do not merge `4` and `5`.

Use the glossary. Do not invent parallel terms (Profile Card / Get Own Employee / Update Own Employee Data / Main Employee Data / Personal Employee Data / Actor / Login-capable). There is no Target on this command or query. Do not call this command Edit Collaborator, Update Main Employee Data, or Update Personal Employee Data.

`EmployeeOwnDataPolicy`, `EmployeeOwnDataPatchService`, and `FindOwnEmployeePort` are implementation names, not glossary terms.

**Out of these slices:** Edit Collaborator routes, matrices, and policies (`EmployeeMainDataPolicy`, `EmployeePersonalDataPolicy`, `EmployeeProfessionalDataPolicy`). Email on this write, including ADMIN self. Occupancy. Professional fields, `status`, `password`, `employmentId`. Get employee by id of another collaborator. Revoking the previous Session Token or incrementing `sessionVersion` when `name` changes (slice 5 reissues; it does not revoke). A Refresh Token or a `remember` flag. Authenticated change-password. A new read-model type. Widening `EmployeeMainDataPatchService`. Calling `updateMainData` or `updatePersonalData` from this command.
