# Spec: Slice 0 — Employment Id counter

> Atomic issuer for Create.  
> Parent: [`README.md`](./README.md).  
> Depends on: none.  
> Next: [`01-usecase.md`](./01-usecase.md).

## Responsibility (this spec only)

Issue the next Employment Id as a digit string. This slice does not call the issuer from Create and does not change HTTP.

| Spec | Responsibility |
|------|----------------|
| **This file** | Outbound port + counter adapter + spec |
| [`01-usecase.md`](./01-usecase.md) | Create calls `allocate()` and persists the string |
| [`02-http-and-contract.md`](./02-http-and-contract.md) | Body ignored, living docs |
| `Employee` schema / mapper / list read model | **Unchanged** |
| `EmployeeMongooseRepository.create` | **Unchanged** — it already writes `employmentId` from the snapshot |

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `AllocateEmploymentIdPort` | Yes |
| `EmploymentIdCounter` + schema + spec | Yes |
| `makeEmployeesModule` | **No** — slice 1 constructs the counter and injects it |
| Use case / controller / `AGENT.md` / `CONTEXT.md` | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of Employment Id on Create following [`docs/specs/employment-id-on-create/00-persistence.md`](./00-persistence.md).  
> Add `AllocateEmploymentIdPort` and `EmploymentIdCounter`. Seed `seq` from the max numeric `employmentId` only when the counter document is missing, then `$inc`.  
> Do not wire Create, do not change the employee schema, do not backfill.

## Application port

File: `application/ports/outbound/allocate-employment-id.port.ts`.

```ts
export interface AllocateEmploymentIdPort {
  allocate(): Promise<string>
}
```

The string is the canonical stored form: `String(seq)` after increment. `seq` starts such that the first successful `allocate()` on an empty numeric history returns `"1"`.

## Counter document

File: `infrastructure/outbound/persistence/employment-id-counter.schema.ts`.

One document, fixed `_id: 'employee'`, field `seq: number`. Collection owned by this hexagon. Do not store the counter on the employee document.

```ts
{ _id: 'employee', seq: number }
```

Schema files are coverage-excluded. Keep the increment and the seed query in the adapter class, not in the schema.

## Adapter

File: `infrastructure/outbound/persistence/employment-id-counter.mongoose.ts`.

Class: `EmploymentIdCounter implements AllocateEmploymentIdPort`.

Constructor receives the employee model (read the current max) and the counter model (seed + `$inc`). Do not fold this into `EmployeeMongooseRepository` — that constructor is shared by every other command.

```ts
async allocate(): Promise<string> {
  await this.ensureSeeded()
  const updated = await this.counterModel.findOneAndUpdate(
    { _id: 'employee' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after' },
  )
  if (!updated) {
    throw new Error('Employment id counter missing after seed')
  }
  return String(updated.seq)
}
```

`returnDocument: 'after'` is required so the caller receives the value just issued, not the previous one.

### Seed

Run only when `{ _id: 'employee' }` is absent.

1. Compute `max` = the maximum integer among employee `employmentId` values that match `^[0-9]+$`. Include every status, including `REMOVED`. If the aggregate returns nothing, `max` is `0`.
2. `updateOne({ _id: 'employee' }, { $setOnInsert: { seq: max } }, { upsert: true })`.

`$setOnInsert` is what makes two concurrent first calls safe: both may read the same `max`, only the insert writes `seq`, the loser does not reset `seq`. Each then `$inc`s, so they receive different numbers (`max + 1` and `max + 2`).

Do not `$inc` inside the seed write. Do not call the aggregate when the counter document already exists. A later Create must not look at `max` again — gaps are allowed, and recomputing `max` would reuse a spent number.

### Which stored values count

| Stored `employmentId` | Counts toward `max`? |
|-----------------------|----------------------|
| absent / `null` | No |
| `""` | No |
| `"HR-001"` or any string with a non-digit | No |
| `"0"` | Yes, integer `0` |
| `"7"` | Yes, integer `7` |
| `"009"` | Yes, integer `9` (the next **issued** value is still unpadded, e.g. `"10"`) |
| any status, including `REMOVED` | Yes, when the string matches |

Use an aggregation `$match` on that regex and `$max` of `$toInt` (or `$toLong`). Do not sort the strings: `"9"` sorts above `"10"`.

Do not update, unset, or backfill employee documents in this adapter.

### Gap

`allocate()` commits the increment before the employee insert. If the insert later fails, do not decrement and do not allocate a second time inside this class. Slice 1 relies on that.

## Files

| File | Action |
|------|--------|
| `application/ports/outbound/allocate-employment-id.port.ts` | Create |
| `infrastructure/outbound/persistence/employment-id-counter.schema.ts` | Create |
| `infrastructure/outbound/persistence/employment-id-counter.mongoose.ts` | Create |
| `infrastructure/outbound/persistence/employment-id-counter.mongoose.spec.ts` | Create |
| Employee schema, mapper, repository, use case, module, HTTP | Do not change |

## Spec expectations

Co-locate the spec. Use [`setupMongoMemoryServer`](../../../src/configs/database/mongoose/test-setup-mongoose-menory.ts) so seed and `$inc` run on a real counter. Do not add a parallel `__tests__` tree.

| `it(...)` | Assert |
|-----------|--------|
| no employees, no counter | first `allocate()` is `"1"`; second is `"2"` |
| employees `"2"`, `"10"`, `null`, `"HR-001"`, and a `REMOVED` `"7"` | first `allocate()` is `"11"`; those documents are unchanged |
| counter already `{ seq: 4 }` while an employee has `"9"` | `allocate()` is `"5"` (do not jump to `10`) |
| two overlapping `allocate()` calls | the two strings differ |

`"009"` may be one extra case: it seeds as `9`, and the issued value has no leading zeros.

## Checklist (agent)

- [ ] Port is outbound, under `application/ports/outbound/`
- [ ] Counter is its own model, `_id: 'employee'`
- [ ] Seed uses `$setOnInsert` and runs only when the counter document is missing
- [ ] Every later issue is `$inc` by 1 and returns `String(seq)`
- [ ] Max ignores `null` and non-digit strings and includes `REMOVED`
- [ ] No employee write, no unique index, no use-case wiring

## Out of scope

- Calling `allocate()` from `CreateEmployeeUsecase`
- Ignoring the Create body
- `AGENT.md` / `CONTEXT.md`

## Acceptance criteria

- [ ] Empty history issues `"1"` then `"2"`
- [ ] Seed max is numeric, not string-sorted, and skips legacy non-digits
- [ ] An existing counter is not reseeded from employee data
- [ ] Overlapping allocations do not return the same string
- [ ] Adapter spec passes

## Reference map

| Concern | Look at |
|---------|---------|
| Employee model type | `infrastructure/outbound/persistence/employee.schema.ts` |
| Mongo memory helper | `src/configs/database/mongoose/test-setup-mongoose-menory.ts` |
| Insert path that will store the string later | `EmployeeMongooseRepository.create` → `mapToCreateDocument` |
| Next slice | [`01-usecase.md`](./01-usecase.md) |
