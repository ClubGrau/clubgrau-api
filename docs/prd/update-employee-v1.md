# PRD: Update Main Employee Data

**Product Requirements Document**
**Date:** 12/09/2026 | **Status:** Design ready | **Version:** 1.0

**Glossary:** [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md)
**Design:** [`docs/design-docs/update-main-employee-data-v1.md`](../design-docs/update-main-employee-data-v1.md)
**ADRs:** [`docs/adr/update-main-employee-data/`](../adr/update-main-employee-data/)
**Sibling:** [`docs/prd/employee-lifecycle-v1.md`](./employee-lifecycle-v1.md) (Deactivate / Reactivate / Vacation / Remove)
**Auth sibling:** [`docs/prd/password-reset-v1.md`](./password-reset-v1.md) (reset is not change-password)

This document specifies the first **Edit Collaborator** command: **Update Main Employee Data**. It corrects full name, email, phone, and username of an existing Target. It does **not** change lifecycle status, password, role, or personal/professional fields.

---

## 1. Overview and objective

Club Grau already **Creates** a collaborator (including an initial password), **Lists** them, and runs lifecycle through **Update Status** (`ACTIVE` | `VACATION` | `INACTIVE`) and **Remove** (Anonymize). There is no command to correct identity fields after Create.

The Edit Collaborator modal is sectioned (main, personal, professional). Operators must be able to save **Dados principais** without writing the rest of the record, and without mixing Deactivate / Vacation into the same request.

**Objective:** one sparse **PATCH** that corrects only the Main Employee Data fields present in the body, under the same Actor/Target matrix used for who may touch an `EMPLOYEE` on the floor.

**Non-goals (this version):**

- Get employee by id (hydrate the modal from the list or later query)
- Personal section (gender, languages, emergency contact, NIF, address)
- Professional section (job title, role, employment id)
- `status` on this body — the modal may still show Status, but it calls **Update Status**
- `password` — personal; Create sets the initial secret; later change/reset belong to Auth
- Username uniqueness
- Revoking Session Tokens when email changes (Auth sibling; same limit as Deactivate)
- Change-password after first login (Auth; password-reset PRD already marks authenticated change out of scope)

---

## 2. Business rules (core logic)

### Rule 2.1 — Edit Collaborator is sectioned; this command is only Main Data

**Edit Collaborator** is the product surface, not one write of the whole record.

| Section | Command (this family) | v1 |
|---------|----------------------|----|
| Dados principais | **Update Main Employee Data** | this PRD |
| Informações pessoais | later | out |
| Informações profissionais | later | out |
| Status | **Update Status** (existing) | out of this body |
| Password | Auth (reset / future change) | out |

Use case name in the hexagon: `UpdateMainEmployeeDataUsecase`.

**Main Employee Data:** `name`, `email`, `phone`, `username`.

### Rule 2.2 — Status and password never travel here

`status` in this body is ignored or rejected. Changing `ACTIVE` / `VACATION` / `INACTIVE` remains `POST /api/employee/update-status` and `EmployeeLifecyclePolicy`.

`password` is not accepted. ADMIN/MANAGER must not set or rotate another person's password on Edit Collaborator. Create still requires an initial password; the collaborator changes it themselves after they can log in (Auth, not this command).

### Rule 2.3 — Sparse PATCH, not a full-section replace

Only fields present in the body are corrected. Omitted fields stay as they are.

| Field | If omitted | If present and blank / `""` / whitespace | If present and `null` |
|-------|------------|------------------------------------------|------------------------|
| `name` | unchanged | `400` | `400` |
| `email` | unchanged | `400` | `400` |
| `phone` | unchanged | `400` | `400` |
| `username` | unchanged | **clear** to `null` | **clear** to `null` |

Body with none of the four fields → `400` (nothing to correct). There is no way to clear `name`, `email`, or `phone` in this command.

`phone` and `username` remain optional on Create. A Target created without them can be patched on `name` / `email` alone. This command does not invent a uniqueness rule for `username`.

### Rule 2.4 — Authority matrix

`EMPLOYEE` operates on nobody. Hiding buttons is not enough; the API enforces the matrix. No Actor password (step-up) on this command.

| Actor ↓ / Target → | EMPLOYEE | MANAGER | ADMIN |
|--------------------|----------|---------|-------|
| EMPLOYEE | refuse | refuse | refuse |
| MANAGER | allow | refuse (including self) | refuse |
| ADMIN | allow | allow | allow (including self) |

Target **Removed** → refuse. `ACTIVE`, `VACATION`, and `INACTIVE` may receive Main Data correction (same identity; email occupancy Rule 2.5).

Actor must be **login-capable** (`ACTIVE` or `VACATION`). Actor identity comes from the Session Token, never from the body.

HTTP gate: `ADMIN` | `MANAGER` on the route (same as Create/List). Fine-grained Target rules stay in the domain.

### Rule 2.5 — Email occupancy (same as Create)

Login and password reset key the person by **email**. The unique index stays.

| New `email` in the PATCH | Outcome |
|--------------------------|---------|
| Omitted, or equal to the Target's current email | Do not run occupancy; not a collision |
| Free, or held only by a **Removed** collaborator | Accept |
| Held by an `ACTIVE` collaborator | `EmployeeAlreadyExistsError` |
| Held by an `INACTIVE` (or `VACATION`) collaborator | `EmployeeInactiveError` — do not steal; that person is still the occupant. Fork remains Reactivate or Remove |

After a successful email change, an existing Session Token is **not** revoked here. Next login uses the new email. Same Auth gap as leftover JWTs after Deactivate.

### Rule 2.6 — Persist only Main Data

The write `$set`s only the fields that changed (`name` / `email` / `phone` / `username`). It must not rewrite `password`, `status`, `role`, `deactivateAt`, `removedAt`, or personal/professional fields. Do not persist a full `toJSON()` snapshot (`Password.toJSON()` is `'[REDACTED]'`).

---

## 3. Data contracts and dependencies

This command lives on the employees hexagon. It does not wait on other modules. Get-by-id is not required to ship it.

**HTTP:**

```http
PATCH /api/employee/:id/main-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{ "name": "...", "email": "...", "phone": "...", "username": "..." }
```

`:id` is the Target. Do not send `id` or `actorId` in the body. The adapter overwrites any forged `actorId` with the JWT id; path `id` wins over a forged body `id`.

Success: `200` with `{ id }` of the Target.

Route: `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`.

| Situation | HTTP (product) |
|-----------|----------------|
| Missing/blank required-if-present field (`name` / `email` / `phone`) | `400` |
| No Main Data field in the body | `400` |
| Invalid email / phone VO | `400` |
| Target not found | `400` |
| Actor missing, not found, or not login-capable | `401` |
| Matrix refusal (EMPLOYEE actor; MANAGER on MANAGER/ADMIN/self) | `403` |
| Target Removed | `409` |
| Email occupied by `ACTIVE` | `409` |
| Email occupied by `INACTIVE` / `VACATION` | `409` |

**Auth (sibling, not this command):** login stays email + password. Changing email does not issue or revoke a Session Token.

**List:** `GET /api/employees` already returns Main Data. The modal hydrates from there in this version.

---

## 4. User stories

1. **As an ADMIN:** I want to correct a collaborator's name or phone without resubmitting the whole record or their password.
2. **As an ADMIN:** I want to change a collaborator's email when the new address is free, so the next login uses that email.
3. **As a MANAGER:** I want to correct Main Data of an `EMPLOYEE` on the floor, and be refused if I target a MANAGER, an ADMIN, or myself.
4. **As an ADMIN:** I want to edit my own name or email from the same command.
5. **As an operator:** I want to clear `username` by sending it empty, without being forced to send name, email, and phone.
6. **As an operator:** I want Status on the Edit Collaborator screen to change `ACTIVE` / `VACATION` / `INACTIVE` through Update Status, not this PATCH.

---

## 5. Edge cases

- **PATCH `{}` or body with only unknown fields:** refuse (`400`).
- **`name` / `email` / `phone` present and empty:** refuse. Do not treat as clear.
- **`username` present and empty / `null`:** clear to `null`.
- **Email unchanged (same Target):** succeed without occupancy lookup.
- **Email taken by `INACTIVE`:** refuse; operator must Reactivate or Remove that occupant first.
- **Target `REMOVED`:** refuse. Do not resurrect sentinels.
- **Target `INACTIVE` or `VACATION`:** Main Data may still be corrected; this is not Reactivate.
- **MANAGER + self, or MANAGER + MANAGER/ADMIN:** refuse even if the client sends the request.
- **EMPLOYEE calling this endpoint:** refuse (`403` at the role gate and/or domain).
- **Actor not login-capable:** refuse (`401`); stale JWT after someone inactivated the Actor. `VACATION` Actor is allowed.
- **Body `status` or `password`:** not part of the contract; ignore or `400`. Do not hash a password here.
- **Body `id` disagreeing with `:id`:** path wins; do not trust the body.
- **Forged `actorId`:** adapter overwrites from the JWT.

---

## 6. Interview analysis (how these rules were reached)

These scenarios were walked during the grilling session. They are the rationale, not extra product scope.

**Why not one save of the whole modal.** A single write mixed lifecycle, role, and PII. A 409 on Last Admin / email occupancy would leave the form half-applied or force two commands in one HTTP call. Sectioned commands match the form stages and keep Update Status on `EmployeeLifecyclePolicy`.

**Why Status stays on the frontend but not in this body.** The modal still needs Ativo / Férias / Inativo. Today the UI only inactivates; lifecycle must also cover Vacation. That remains **Update Status**. Sending `status` on Save would bypass Last Admin and the INACTIVE fork.

**Why password is out.** Password is personal. Create still plants the first secret. Reset already exists. Authenticated change after first login is Auth, not ADMIN/MANAGER editing the record. The Edit Collaborator form will drop password.

**Why PATCH and sparse.** Operators correct one typo (name or phone) without resubmitting email. Full-section replace would invent required `username` / `phone` for people created without them.

**Why blank `phone` is an error but blank `username` clears.** Name, email, and phone are required-if-present (VOs / business identity). Username is optional on Create and is the only Main Data field that may be emptied.

**Why `id` is in the path.** PATCH applies a delta to the resource URL. Lifecycle POSTs keep `id` in the body (RPC intent). Edit Collaborator sections share a Target: `/employee/:id/main-data`, later `/personal-data`. `adaptRoute` already merges params; path `id` wins over a forged body `id`. Do not send both.

**Why email occupancy equals Create.** An `INACTIVE` person still owns their email until Remove. Stealing it on PATCH would skip the Reactivate-or-Remove fork and collide with login.

**Why MANAGER cannot edit self or peers.** Same floor rule as lifecycle: MANAGER is aimed at `EMPLOYEE`. ADMIN identity stays among ADMINs. Self-edit is an ADMIN concern (or a future self-service command, not this one).

**Why no Get-by-id in v1.** List already returns Main Data. This document is the write. Hydration is a later query.

**Why JWT is not revoked on email change.** Same Auth sibling as Deactivate/Remove. This command must not pretend to own sessions.

---

## 7. Acceptance criteria (minimum)

- [ ] ADMIN + Target `EMPLOYEE` + `{ "name": "João Silva" }` → `200 { id }`; email, phone, username unchanged.
- [ ] ADMIN + `{ "username": "" }` → username becomes `null`; other Main Data unchanged.
- [ ] `{ "phone": "" }` or `{ "name": "" }` → `400`; no write.
- [ ] `PATCH` with empty body → `400`; no write.
- [ ] Email changed to a free address → persist; occupancy not applied to the Target's previous email as a collision with itself.
- [ ] Email changed to an address held by `ACTIVE` → refused; no write.
- [ ] Email changed to an address held by `INACTIVE` → refused; no write.
- [ ] MANAGER + Target `EMPLOYEE` → allowed; MANAGER + Target `MANAGER` / `ADMIN` / self → `403`.
- [ ] EMPLOYEE token → `403`.
- [ ] Target `REMOVED` → refused.
- [ ] Target `INACTIVE` or `VACATION` + valid name patch → allowed.
- [ ] Body cannot spoof `actorId`; Target id is `:id`, not the body.
- [ ] `status` / `password` in the body do not change those fields.
- [ ] Persistence writes only the changed Main Data fields (no full document / redacted password).
