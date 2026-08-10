# Spec: Apply existing value object to an entity

> AI / implementation contract for wiring a **shared VO that already exists** into a domain entity.  
> Global rules: [`AGENTS.md`](../../AGENTS.md).  
> Canonical example: `Email` on [`Employee`](../../src/modules/employees/domain/entities/Employee.ts).

## When to use this spec

Use this document (or a short copy of the [Fill-in](#fill-in) block in chat) when asking the agent to **compose an existing VO into an entity**.

| Artifact | Use? |
|----------|------|
| This **spec** | Yes — defines *what* to wire and the acceptance bar |
| **Rule** / `AGENTS.md` | Only if the agent keeps missing the pattern below |
| **Skill** | No — this is not a special workflow; follow the entity playbook |

Do **not** create a new VO here. If the VO does not exist yet, stop and follow [`create-value-object.md`](./create-value-object.md) first (Fill-in + product invariants), then return to this spec.

## Fill-in

Copy and complete before implementing:

| Field | Value |
|-------|-------|
| VO (class + path) | e.g. `Phone` → `@shared/domain/value-object` |
| Entity | e.g. `Employee` / `Customer` |
| Module | e.g. `src/modules/employees` |
| Field name on entity | e.g. `phone` |
| Required on create? | yes / no (if no → `Vo \| null`, omit → `null`) |
| HTTP / DTO surface changes? | yes / no — if yes, list endpoints |
| Persistence field type | e.g. `string \| null` on schema |

**Prompt sketch for the agent:**

> Apply the existing VO `<Vo>` to entity `<Entity>` in `<module>`.  
> Follow [`docs/specs/apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md).  
> Mirror how `Email` is used on `Employee`. Update layers only where the contract changes.

## Pattern (normative)

### Domain entity

1. **Props** store the VO type, not the primitive:
   - required: `field: Vo`
   - optional: `field: Vo | null`
2. **`create(input)`** — input uses primitives; entity calls `Vo.create(...)` (or skips `create` and sets `null` when optional and absent).
3. **`reconstitute(input)`** — input already typed with `Vo` (or `Vo | null`); assign directly; do not re-run `Vo.create` unless reconstituting from raw primitives in the same factory.
4. **Mutators** (if the field can change) take the VO: `changeField(value: Vo): void`.
5. Invalid values are rejected by the VO (`DomainError` subclass); the entity does not re-validate format.

### Application

- Create/update DTOs use **primitives** at the boundary (`string`, `number`, …).
- Use case / command: pass primitives into `Entity.create`, or `Vo.create` before a mutator — same style as existing commands in the module.
- Read models / list DTOs stay as primitives; never expose the VO class over HTTP.

### Presentation

- Controller validates **presence** of required body/query fields only.
- Forward optional fields when present; do not instantiate VOs in the controller.

### Infrastructure

| Layer | Responsibility |
|-------|----------------|
| Schema | Persist the primitive (or null) |
| Mapper | document ↔ snapshot/DTO primitives; VO construction stays in domain factories / repo path that calls `reconstitute` |
| Repository | When rebuilding the entity, build VOs then `Entity.reconstitute(...)` |

### Tests

- Entity spec: fixtures via `Vo.create(...)`; cover create / reconstitute / mutator as applicable.
- Do not duplicate full VO validation matrix on the entity — that belongs in `*.vo.spec.ts`.
- Update use case / controller / repository specs only if their contracts changed.

### Docs / client

- If the HTTP contract changed: update `src/client/<module>.http` and the module [`AGENT.md`](../../src/modules/employees/AGENT.md) (living contract).
- Do not log cosmetic renames in docs.

## Checklist (agent)

- [ ] VO imported from `@shared/domain` (or the owning module) — not reimplemented
- [ ] `EntityProps` / create / reconstitute / mutators aligned with the pattern above
- [ ] DTOs + ports updated if the write/read contract includes the field
- [ ] Schema + mapper + repository path updated if persisted
- [ ] Co-located `*.spec.ts` updated for touched layers
- [ ] `.http` + module `AGENT.md` updated only if the external contract changed
- [ ] No Express / Mongoose imports in domain
- [ ] No write snapshot reused as HTTP list/get response

## Out of scope

- Creating a new value object → [`create-value-object.md`](./create-value-object.md)
- Changing VO validation rules
- Cross-module imports of another hexagon’s internal `domain`
- Introducing a Cursor skill for this task

## Acceptance criteria

- [ ] Entity compiles with the field typed as the existing VO (`Vo` or `Vo | null`)
- [ ] `create` builds the VO from primitives (or `null` when optional/absent)
- [ ] `reconstitute` accepts the VO without dropping invariants
- [ ] Persistence round-trip keeps the primitive form expected by schema/mapper
- [ ] Specs covering the touched entity (and any changed use case/controller) pass
- [ ] Module contract docs/`.http` match reality when HTTP changed

## Reference map

| Concern | Look at |
|---------|---------|
| Entity + VO composition | `src/modules/employees/domain/entities/Employee.ts` |
| Entity tests with VOs | `src/modules/employees/domain/entities/employee.spec.ts` |
| Shared VOs | `src/shared/domain/value-object/` |
| Global playbooks | [`AGENTS.md`](../../AGENTS.md) |
| Create VO first | [`create-value-object.md`](./create-value-object.md) |
| Feature that creates then applies a VO | [`create-customer.md`](./create-customer.md) |
