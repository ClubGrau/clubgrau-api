# PRD: Update Personal Employee Data

**Product Requirements Document**
**Date:** 17/09/2026 | **Status:** Design ready | **Version:** 1.0

**Glossary:** [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md)
**Design:** [`docs/design-docs/update-personal-employee-data-v1.md`](../design-docs/update-personal-employee-data-v1.md)
**Sibling (Main Data):** [`docs/prd/update-employee-v1.md`](./update-employee-v1.md)
**Sibling (lifecycle):** [`docs/prd/employee-lifecycle-v1.md`](./employee-lifecycle-v1.md)
**Auth sibling:** [`docs/prd/password-reset-v1.md`](./password-reset-v1.md)

This document specifies the second **Edit Collaborator** command: **Update Personal Employee Data**. It corrects gender, languages, emergency contact, NIF, and address of an existing Target. It does **not** change identity fields (Main Data), lifecycle status, password, role, or professional fields.

---

## 1. Overview and objective

Club Grau already corrects **Main Employee Data** (name, email, phone, username) via `PATCH /api/employee/:id/main-data`. The Edit Collaborator modal has a second section — **Informações pessoais** — covering gender, languages, emergency contact, NIF, and address.

**Objective:** one sparse PATCH that corrects only the Personal Employee Data fields present in the body, under the same Actor/Target authority matrix used for Main Data.

**Non-goals (this version):**

- Get employee by id (modal hydrates from the list or later query)
- Professional section (job title, role, employment id)
- Self-service: EMPLOYEE editing their own personal data (future profile card — see open decisions)
- `status`, `password`, `phone` — each belongs to its own command
- `name`, `email`, `username` — those are Main Data

---

## 2. Business rules (core logic)

### Rule 2.1 — Edit Collaborator is sectioned; this command is only Personal Data

| Section | Command (this family) | v |
|---------|----------------------|---|
| Dados principais | Update Main Employee Data | shipped |
| **Informações pessoais** | **Update Personal Employee Data** | **this PRD** |
| Informações profissionais | later | out |
| Status | Update Status (existing) | out of this body |
| Password | Auth (reset / future change) | out |

Use case name in the hexagon: `UpdatePersonalEmployeeDataUsecase`.

**Personal Employee Data:** `gender`, `languages`, `emergencyContact`, `nif`, `address`.

### Rule 2.2 — Sparse PATCH, not a full-section replace

Only fields present in the body are corrected. Omitted fields stay as they are. All five fields are **clearable** — present and null or blank clears to `null`.

| Field | If omitted | If present + valid | If present + null / blank |
|-------|------------|-------------------|--------------------------|
| `gender` | unchanged | validates enum → stores | clears to `null` |
| `languages` | unchanged | stores string | clears to `null` |
| `emergencyContact` | unchanged | validates `Phone` VO → stores | clears to `null` |
| `nif` | unchanged | validates `Nif` VO → stores | clears to `null` |
| `address` | unchanged | stores string | clears to `null` |

Body with none of the five fields → `400` (nothing to correct).

### Rule 2.3 — `gender` is a validated enum

`gender` accepts only the three canonical values. Any other non-null string → `400 InvalidParamError('gender')`.

| Frontend label | API value |
|----------------|-----------|
| Masculino | `'male'` |
| Feminino | `'female'` |
| Outros | `'other'` |
| Não informado | `null` (clears the field) |

The enum lives in `EmployeeModel.Gender` alongside `Status` and `Role`.

### Rule 2.4 — VO fields are validated when non-null

- `emergencyContact`: validated by `Phone.create`. Invalid format → `400`.
- `nif`: validated by `Nif.create`. May arrive as string or number in the body (same coercion as Create). Invalid format or check digit → `400`.

`gender` validation (Rule 2.3) also applies on every non-null value.

### Rule 2.5 — `languages` is a free string

`languages` accepts any non-empty string. No controlled list. The frontend uses a single text input. Future work may restructure this field (e.g. to an array or a controlled list) — tracked as an open decision.

### Rule 2.6 — Authority matrix

Same as Update Main Employee Data.

| Actor ↓ / Target → | EMPLOYEE | MANAGER | ADMIN |
|--------------------|----------|---------|-------|
| **EMPLOYEE** | refuse | refuse | refuse |
| **MANAGER** | allow | refuse (incl. self) | refuse |
| **ADMIN** | allow | allow | allow (incl. self) |

- Actor must be **login-capable** (`ACTIVE` or `VACATION`).
- Target **Removed** → refuse. `ACTIVE`, `VACATION`, and `INACTIVE` may receive Personal Data correction.
- Actor identity comes from the Session Token, never from the body.
- HTTP gate: `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')`.

### Rule 2.7 — Persist only Personal Data

The write `$set`s only the fields present in the body. Must not touch `name`, `email`, `phone`, `username`, `password`, `status`, `role`, `deactivateAt`, `removedAt`, or professional fields. Do not persist a full `toJSON()` snapshot.

---

## 3. Data contracts and dependencies

This command lives on the employees hexagon. It does not wait on other modules.

**HTTP:**

```http
PATCH /api/employee/:id/personal-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{
  "gender": "male",
  "languages": "Português",
  "emergencyContact": "+351 912 345 678",
  "nif": "123456789",
  "address": "Rua do Grau, 10, Lisboa"
}
```

`:id` is the Target. Do not send `id` or `actorId` in the body. The adapter overwrites any forged `actorId` with the JWT id; path `id` wins over a forged body `id`.

Success: `200` with `{ data: { id } }` of the Target.

Route: `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`.

| Situation | HTTP |
|-----------|------|
| No personal field in body | `400` |
| Invalid `gender` value (non-null, not in enum) | `400` |
| Invalid `emergencyContact` phone format | `400` |
| Invalid `nif` format / check digit | `400` |
| Target not found | `400` |
| Actor missing, not found, or not login-capable | `401` |
| Matrix refusal (EMPLOYEE actor; MANAGER on MANAGER/ADMIN/self) | `403` |
| Target Removed | `409` |
| Unexpected | `500` |

Unknown keys in the body are ignored. Body with only unknown keys → `400`.

---

## 4. User stories

1. **As an ADMIN:** I want to record the gender and address of a collaborator after they have been created, without resubmitting identity fields.
2. **As an ADMIN:** I want to update the emergency contact of a collaborator when it changes, without sending the whole record.
3. **As an ADMIN:** I want to correct a collaborator's NIF when it was entered incorrectly, or clear it if it no longer applies.
4. **As a MANAGER:** I want to correct personal data of an EMPLOYEE on the floor, and be refused if I target a MANAGER, an ADMIN, or myself.
5. **As an operator:** I want to clear a field (e.g. NIF) by sending `null`, without being forced to send all other personal fields.

---

## 5. Edge cases

- **`{}` or body with only unknown fields:** refuse (`400`).
- **`gender: "invalid"`:** refuse (`400`); no write.
- **`emergencyContact: "123"`:** refuse (`400 InvalidPhoneFormatError`); no write.
- **`nif: "00000000"` (bad check digit):** refuse (`400`); no write.
- **`nif` arrives as number** (e.g. `123456789`): coerce to string before `Nif.create`, same as Create.
- **`{ "address": null }`:** clears address; other personal fields unchanged.
- **`{ "languages": "" }` / `{ "languages": null }`:** clears languages to `null`.
- **Target `REMOVED`:** refuse. Do not overwrite sentinels with personal data.
- **Target `INACTIVE` or `VACATION`:** personal data may still be corrected; this is not Reactivate.
- **MANAGER + self, or MANAGER + MANAGER/ADMIN:** refuse even if the client sends the request.
- **EMPLOYEE calling this endpoint:** refuse (`403` at the role gate).
- **Actor not login-capable:** refuse (`401`); stale JWT after someone inactivated the Actor. `VACATION` Actor is allowed.
- **Body `id` disagreeing with `:id`:** path wins; do not trust the body.
- **Forged `actorId`:** adapter overwrites from the JWT.
- **`status` or `password` in the body:** unknown keys — ignored. Body still needs at least one personal field, else `400`.

---

## 6. Interview analysis (how these rules were reached)

**Why all five fields are clearable.** None is a business identity anchor or a login key. An operator who selects "Não informado" on the gender dropdown is expressing the absence of a value. The same logic applies to NIF, address, emergency contact, and languages — all are optional since Create. Blocking the operator from clearing a wrongly-entered NIF would leave bad data permanently.

**Why gender is an enum.** The frontend uses a dropdown with a fixed set. Storing an arbitrary string would allow inconsistent data if the API is called directly. The enum lives in `EmployeeModel.Gender` alongside `Status` and `Role`, following the established pattern.

**Why "Não informado" maps to null.** Two representations of "no value" (`null` vs `'not_informed'`) would complicate queries and display logic. `null` is the single canonical form; clearing and "Não informado" are the same action.

**Why languages stays as a free string.** The frontend shows a single text input. Restructuring to an array or a controlled list would require a schema migration. The field is kept as `string | null` in v1 and tracked as future work.

**Why a new EmployeePersonalDataPolicy.** The matrix is identical to Main Data today. However, a future self-service command (EMPLOYEE editing their own personal data via a profile card) will need a different matrix (EMPLOYEE + self only). Separate policies diverge cheaply; a merged policy would require invasive changes when the matrices split.

**Why no occupancy check.** Personal fields have no uniqueness constraint. NIF is not a login key. No index to enforce; no conflict to detect.

**Why emergencyContact stays as Phone VO only.** The frontend form shows only a phone number input (with country code selector). The AGENT.md already notes that `emergencyContact` may become a richer VO (name + kinship + phone) if the form grows; that remains future work.

---

## 7. Open decisions

- **Self-service personal data:** A future profile card will let an EMPLOYEE edit their own personal data. This requires a separate command (`UpdateOwnPersonalDataUsecase`) with its own policy (EMPLOYEE + self only). Out of scope for this wave. `EmployeePersonalDataPolicy` must not be changed to accommodate this; a new policy is the correct path.
- **`languages` restructure:** If the product evolves to a multi-select or controlled list, `languages` will need a schema migration (`string` → `[String]` or enum). Tracked as future work.
- **`emergencyContact` VO growth:** `emergencyContact` may become a richer `EmergencyContact` VO (name + kinship + phone) if the form adds those fields. Tracked in `AGENT.md`.

---

## 8. Acceptance criteria (minimum)

- [ ] ADMIN + Target EMPLOYEE + `{ "gender": "male" }` → `200 { data: { id } }`; other personal fields unchanged.
- [ ] `{ "nif": null }` → NIF cleared to `null`; other personal fields unchanged.
- [ ] `{ "emergencyContact": null }` → emergency contact cleared; other fields unchanged.
- [ ] `{ "gender": "invalid" }` → `400`; no write.
- [ ] `{ "emergencyContact": "123" }` → `400`; no write.
- [ ] `{ "nif": "00000000" }` (bad check digit) → `400`; no write.
- [ ] `{}` or body with only unknown keys → `400`; no write.
- [ ] Body with all five fields → `200`; all five updated atomically.
- [ ] MANAGER + Target EMPLOYEE → allowed; MANAGER + Target MANAGER / ADMIN / self → `403`.
- [ ] EMPLOYEE token → `403`.
- [ ] Target `REMOVED` → refused.
- [ ] Target `INACTIVE` or `VACATION` + valid patch → allowed.
- [ ] Persistence writes only the present personal fields (no Main Data, no password, no status).
- [ ] Body cannot spoof `actorId`; Target id is `:id`, not body.
