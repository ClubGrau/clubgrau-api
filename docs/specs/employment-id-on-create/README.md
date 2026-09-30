# Specs: Employment Id on Create

> Implementation contracts for issuing `employmentId` on Create Employee.  
> Glossary: [`src/modules/employees/CONTEXT.md`](../../../src/modules/employees/CONTEXT.md).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md) · hexagon: [`employees/AGENT.md`](../../../src/modules/employees/AGENT.md).

There is no PRD and no design doc for this change. These specs are the contract. Implement **one slice at a time**, in this order. Do not skip. Do not pull later-slice HTTP or living-doc work into an earlier slice.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-persistence.md`](./00-persistence.md) | `AllocateEmploymentIdPort` + `EmploymentIdCounter` (atomic `seq`, seeded from the max numeric `employmentId`) |
| 1 | [`01-usecase.md`](./01-usecase.md) | `CreateEmployeeUsecase` issues the number after validation, occupancy, and encrypt, and persists that string |
| 2 | [`02-http-and-contract.md`](./02-http-and-contract.md) | Create body `employmentId` ignored, `employee.http`, living `AGENT.md` + `CONTEXT.md` |

**Dependencies:** `1` needs `0`. `2` needs `1`. Do not merge slices.

Use the glossary term **Employment Id**. The API field remains `employmentId`. Do not add a second registration field.

## Product rule

Create issues the Employment Id.

| Rule | Contract |
|------|----------|
| Shape | Positive integer from `1`, no leading zeros, stored as a digit string (`"1"`, `"2"`, `"10"`) |
| Source | Backend only. A value on the Create body is ignored and is not an error |
| Response | `POST /api/employee` stays `{ id }` |
| Read | `GET /api/employees` already returns `employmentId`. No new read field |
| Uniqueness | Newly issued values are unique. A number is never reused, including after Remove |
| Concurrency | Two Creates in flight both succeed, with different numbers |
| Gap | If issuance succeeds and the employee insert then fails, the number is spent. Do not fill the hole |
| Legacy | Do not rewrite existing documents. `null` and non-digit strings (for example `HR-001`) stay and do not seed the counter |
| Immutability | No command writes `employmentId` after Create. Remove keeps the stored value |

The counter is the source of the next number after it exists. Do not recompute `max` on every Create. Seed once, when the counter document is absent, from the max integer among stored digit strings (any status, including `REMOVED`). If none exist, the first issued value is `"1"`.

## Domain

No domain slice. Do not add an Employment Id mutator. `Employee.create` / `Employee.reconstitute` keep accepting `employmentId` so persistence can rebuild a record and so Create can place the issued string on the insert snapshot. `anonymize()` stays as it is (it does not clear `employmentId`).

## Out of these slices

- Backfill or migration of existing employees
- Unique index on `employmentId` (multiple `null`s and legacy strings must keep persisting)
- Returning `employmentId` on the Create response
- Editing the number from Main, Personal, Professional, Update Status, or Remove
- `CONTEXT-MAP.md`, root `AGENTS.md`, and the historical Update Professional Employee Data PRD / design / specs
