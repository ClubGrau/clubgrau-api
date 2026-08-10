# Spec: Create a value object

> AI / implementation contract for adding a **new** value object that follows the shared VO pattern.  
> Global rules: [`AGENTS.md`](../../AGENTS.md).  
> Canonical examples: [`Email`](../../src/shared/domain/value-object/email/email.vo.ts), [`Name`](../../src/shared/domain/value-object/name/name.vo.ts), [`Phone`](../../src/shared/domain/value-object/phone/phone.vo.ts).

## When to use this spec

Use this document when the VO **does not exist yet**. Complete the [Fill-in](#fill-in), then implement.

| Artifact | Use? |
|----------|------|
| This **spec** | Yes — shape + checklist for a new VO |
| Feature / product rules | Yes — put invariants in Fill-in (or in the feature spec that links here) |
| [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md) | **After** the VO exists — wiring into an entity is a separate step |
| **Rule** / `AGENTS.md` | Naming already covered; extend only if the agent drifts from the pattern |
| **Skill** | No — mirror existing VOs; no special workflow |

## Spec track (order)

```text
1. create-value-object.md          → VO exists + *.vo.spec.ts
2. apply-existing-value-object…    → entity / module compose the VO
3. feature spec (optional)         → HTTP / use case (e.g. create-customer.md)
```

Feature specs should **link** here for VO creation and to the apply-entity spec for composition — they should not restate the VO implementation shape.

## Fill-in

Copy and complete before implementing:

| Field | Value |
|-------|-------|
| Class name | e.g. `Phone` |
| Folder / file | e.g. `src/shared/domain/value-object/phone/phone.vo.ts` |
| Scope | `@shared/domain` (default) / module-local (rare) |
| Primitive input type | e.g. `string` |
| Error class | e.g. `InvalidPhoneFormatError` |
| Normalization | e.g. trim + lowercase / digits-only / collapse whitespace |
| Invariants | bullet list of rules that throw |
| Valid examples | … |
| Invalid examples | … |
| Extra methods? | e.g. none / `domain` getter like `Email` |
| Out of VO scope | what this VO must **not** decide |

**Prompt sketch for the agent:**

> Create the VO `<Class>` under `@shared/domain`.  
> Follow [`docs/specs/create-value-object.md`](./create-value-object.md).  
> Mirror `Email` / `Name` / `Phone`. Fill-in: \<paste table\>.  
> Do not wire into an entity yet unless also pointed at [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md).

## Pattern (normative)

Align with existing shared VOs — **throwing factory**, not a `Result` union.

1. **Location:** `src/shared/domain/value-object/<kebab-name>/<kebab-name>.vo.ts` (+ co-located `*.vo.spec.ts`).
2. **Base:** `extends ValueObject<Props>`; `Props` usually `{ value: TPrimitive }`.
3. **Constructor:** `private`; only `static create(...)` builds instances.
4. **Error:** `export class InvalidXError extends DomainError {}` co-located with the VO (same style as `InvalidEmailError`).
5. **`create(value)`:**
   - reject `null` / `undefined` (required when `create` is called);
   - normalize (trim, case, strip formatting, etc. per Fill-in);
   - enforce invariants → throw `InvalidXError` with a clear message;
   - return `new Vo({ value: normalized })`.
6. **API surface:** `get value()`, `toJSON()` (primitive), `toString()`; equality via base `ValueObject.equals`.
7. **Export:** register class + error in [`src/shared/domain/value-object/index.ts`](../../src/shared/domain/value-object/index.ts).
8. **Purity:** no Express, Mongoose, env, bcrypt, or application-layer imports.

### Spec expectations (`*.vo.spec.ts`)

- happy path + normalization
- invalid cases (`it.each` when useful)
- null / undefined / empty as required by Fill-in
- equality for the same normalized value (when relevant)
- do not test entity/HTTP here

## Checklist (agent)

- [ ] File naming: `kebab-case.vo.ts` / `kebab-case.vo.spec.ts`
- [ ] Private constructor + `static create` that throws on invalid input
- [ ] `DomainError` subclass exported next to the VO
- [ ] Normalization and invariants match Fill-in
- [ ] `toJSON` / `toString` / `value` consistent with stored form
- [ ] Barrel export updated
- [ ] Co-located unit spec covers valid / invalid / normalize
- [ ] No framework imports in the VO

## Out of scope

- Wiring the VO into an entity, DTO, schema, or HTTP (use [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md))
- Uniqueness / persistence / auth policies (application or entity)
- Changing the `ValueObject` base class unless explicitly requested

## Acceptance criteria

- [ ] VO can be imported from `@shared/domain/value-object` (or agreed module path)
- [ ] Valid Fill-in examples construct successfully and expose the expected normalized value
- [ ] Invalid Fill-in examples throw the declared error class
- [ ] `*.vo.spec.ts` passes
- [ ] Domain stays framework-free

## Reference map

| Concern | Look at |
|---------|---------|
| Base class | `src/shared/domain/value-object/value-object.ts` |
| Simple string VO | `name/name.vo.ts` |
| Regex + normalize | `email/email.vo.ts` |
| Digits / format strip | `phone/phone.vo.ts` |
| Barrel | `src/shared/domain/value-object/index.ts` |
| Next step: entity | [`apply-existing-value-object-to-entity.md`](./apply-existing-value-object-to-entity.md) |
| Feature example | [`create-customer.md`](./create-customer.md) |
