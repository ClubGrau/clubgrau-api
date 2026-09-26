# PRD: Update Professional Employee Data

**Product Requirements Document**
**Date:** 25/09/2026 | **Status:** Design ready | **Version:** 1.0

**Glossary:** [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md)
**Design:** [`docs/design-docs/update-professional-employee-data-v1.md`](../design-docs/update-professional-employee-data-v1.md)
**ADRs:** [`docs/adr/update-professional-employee-data/`](../adr/update-professional-employee-data/)
**Sibling (Main Data):** [`docs/prd/update-employee-v1.md`](./update-employee-v1.md)
**Sibling (Personal Data):** [`docs/prd/update-personal-employee-data-v1.md`](./update-personal-employee-data-v1.md)
**Sibling (lifecycle):** [`docs/prd/employee-lifecycle-v1.md`](./employee-lifecycle-v1.md)
**Auth sibling:** [`docs/prd/password-reset-v1.md`](./password-reset-v1.md)

This document specifies the third **Edit Collaborator** command: **Update Professional Employee Data**. It corrects Job Title and, when allowed, Role of an existing Target. When Status is present and different from the Target's current status, the same request applies that lifecycle action through the existing rules. It does **not** change Main Data, Personal Data, password, or Employment Id.

---

## 1. Overview and objective

Club Grau already corrects **Main Employee Data** and **Personal Employee Data** via dedicated PATCHes. The Edit Collaborator modal has a third section — **Informações profissionais** — showing Job Title, Role, Status, and a read-only Employment Id (matrícula).

API names stay as they are today. Frontend labels are inverted relative to the screenshot that shipped first:

| UI label (this wave) | API field | Meaning |
|----------------------|-----------|---------|
| Função | `jobTitle` | free text (e.g. Barbeiro) |
| Cargo | `role` | `ADMIN` \| `MANAGER` \| `EMPLOYEE` |
| Status | `status` | operational lifecycle |
| Matrícula | `employmentId` | **not sent, not written** |

**Objective:** one sparse **PATCH** on a dedicated professional endpoint. The operator clicks **Salvar seção** once. Job Title, a real Role change, and a real Status change succeed together or not at all.

**Non-goals (this version):**

- Get employee by id (modal hydrates from the list or later query)
- Updating `employmentId` (shape still open on Create; form does not send it)
- Self-service: EMPLOYEE editing their own professional data
- `password` — Auth (reset / future change)
- `name`, `email`, `phone`, `username` — Main Data
- `gender`, `languages`, `emergencyContact`, `nif`, `address` — Personal Data
- Revoking Session Tokens when role or status changes (Auth sibling; same limit as Deactivate)
- Replacing `POST /api/employee/update-status` — that endpoint stays for one-shot list actions

---

## 2. Business rules (core logic)

### Rule 2.1 — Edit Collaborator is sectioned; this command is the professional endpoint

| Section | Command | v |
|---------|---------|---|
| Dados principais | Update Main Employee Data | shipped |
| Informações pessoais | Update Personal Employee Data | shipped |
| **Informações profissionais** | **Update Professional Employee Data** | **this PRD** |
| Status (list shortcut) | Update Status (existing) | stays |
| Password | Auth (reset / future change) | out |

Use case name in the hexagon: `UpdateProfessionalEmployeeDataUsecase`.

**Professional Employee Data (writable here):** `jobTitle`, `role`.

**May travel in the same save:** `status` — a lifecycle action, not a professional field.

**Not writable here:** `employmentId`.

### Rule 2.2 — Sparse PATCH; Job Title is clearable

Only keys present in the body are considered. Omitted fields stay as they are.

| Field | If omitted | If present + valid | If present + `null` / blank / whitespace |
|-------|------------|-------------------|------------------------------------------|
| `jobTitle` | unchanged | stores string | **clear** to `null` |
| `role` | unchanged | enum; **change** only if different from Target (Rule 2.4) | `400` |
| `status` | unchanged | operational enum; **change** only if different from Target (Rule 2.5) | `400` |

At least one of `jobTitle` / `role` / `status` must be present. `{}`, only unknown keys, or only `employmentId` → `400`.

`password` in the body → `400` (not of this command). Unknown keys (including `employmentId`) are ignored and do not count as a field to correct.

### Rule 2.3 — Authority for Job Title (same matrix as Main / Personal)

`EMPLOYEE` operates on nobody. Hiding buttons is not enough. No Actor password (step-up) on this command.

| Actor ↓ / Target → | EMPLOYEE | MANAGER | ADMIN |
|--------------------|----------|---------|-------|
| EMPLOYEE | refuse | refuse | refuse |
| MANAGER | allow | refuse (including self) | refuse |
| ADMIN | allow | allow | allow (including self) |

Target **Removed** → refuse (`409`). `ACTIVE`, `VACATION`, and `INACTIVE` may receive Job Title (and Role, Rule 2.4). Correcting an `INACTIVE` Target is **not** Reactivate.

Actor must be **login-capable** (`ACTIVE` or `VACATION`). Actor identity comes from the Session Token, never from the body.

HTTP gate: `ADMIN` | `MANAGER` on the route (same as Create/List/Main/Personal). Fine-grained Target rules and Role change stay in the domain.

### Rule 2.4 — Changing Role is ADMIN-only; only a delta counts

`role` is the system-access enum: `ADMIN` | `MANAGER` | `EMPLOYEE`. Invalid value → `400`.

| Body `role` vs Target | Who may do it |
|-----------------------|---------------|
| Equal to current | **no-op** — not a change. MANAGER may echo it. |
| Different | **ADMIN only**. MANAGER → `403`; nothing is written (not Job Title, not status). |

Last Admin cannot **leave** `ADMIN` (`409 LastAdminProtectedError`) when either is true:

1. The Target is the last login-capable ADMIN (`ACTIVE` or `VACATION`)
2. The Target is the last non-`REMOVED` ADMIN

`countActiveAdmins` (ACTIVE-only) is **not** enough for (1): an ADMIN on `VACATION` still counts as login-capable. Promoting someone **to** `ADMIN` never hits this guard. Rebasing `MANAGER` → `EMPLOYEE` never hits it.

Changing Role of an `INACTIVE` Target does not Reactivate them.

### Rule 2.5 — Status may travel here; only a delta is a lifecycle action

When `status` is present and **different** from the Target's current status:

- Legal values: `ACTIVE` | `INACTIVE` | `VACATION`. `REMOVED` → `400` (Remove stays on its own command).
- Map to intent and run **`EmployeeLifecyclePolicy`**: `ACTIVE→REACTIVATE`, `INACTIVE→DEACTIVATE`, `VACATION→VACATION`.
- Apply `activate` / `deactivate` / `putOnVacation` (including `deactivateAt`).
- Same Actor/Target/Last Admin matrix as `POST /api/employee/update-status`.

When `status` is present and **equal** to the current status: **no-op**. Do not throw already-in-status. Do not write `deactivateAt`.

`POST /api/employee/update-status` **keeps** already-in-status → `400`. That endpoint remains the list shortcut.

A lifecycle refusal (matrix, Last Admin, already Removed, …) aborts the **whole** request. Job Title and Role are not persisted.

### Rule 2.6 — One write, all or nothing

Evaluate Job Title matrix, Role delta (if any), and Status delta (if any) **before** persisting. Any refusal → no `$set`.

Persist only the fields that actually change (`jobTitle` and/or `role` and/or `status` + `deactivateAt`). Do not rewrite password, Main Data, Personal Data, `employmentId`, or a full `toJSON()` snapshot.

`role` / `status` equal to current are not persisted as changes. `jobTitle` present (even the same string) may `$set` Job Title, same as Main Data echoing `name`.

A body with only echoed `role` and/or echoed `status` (no `jobTitle`) → `200`, no write.

### Rule 2.7 — Sessions stay with Auth

This command does not revoke or reissue a Session Token when Role or Status changes. A leftover JWT may still carry the old role until Auth re-checks. Same gap as Deactivate and email change.

---

## 3. Data contracts and dependencies

This command lives on the employees hexagon. It reuses `EmployeeLifecyclePolicy` (and Last Admin counts) when Status actually changes. It does not wait on other modules. Get-by-id is not required to ship it.

**HTTP:**

```http
PATCH /api/employee/:id/professional-data
Authorization: Bearer <Actor token>
Content-Type: application/json

{ "jobTitle": "Barbeiro", "role": "EMPLOYEE", "status": "ACTIVE" }
```

`:id` is the Target. Do not send `id` or `actorId` in the body. The adapter overwrites any forged `actorId` with the JWT id; path `id` wins over a forged body `id`.

Success: `200` with `{ data: { id } }` of the Target.

Route: `authTokenMiddleware` + `requireRoles('ADMIN', 'MANAGER')` + `adaptRoute`.

| Situation | HTTP (product) |
|-----------|----------------|
| No `jobTitle` / `role` / `status` in the body | `400` |
| `password` in the body | `400` |
| Invalid `role` (not in enum) | `400` |
| Invalid `status` (not operational, including `REMOVED`) | `400` |
| `role` / `status` present and null / blank | `400` |
| Target not found | `400` |
| Already-in-status **on this PATCH** (echo) | `200` (no-op), not `400` |
| Actor missing, not found, or not login-capable | `401` |
| Matrix refusal (EMPLOYEE actor; MANAGER on MANAGER/ADMIN/self) | `403` |
| MANAGER sending a **different** `role` | `403` |
| Target Removed | `409` |
| Last Admin leaving `ADMIN`, or Last Admin status transition | `409` |
| Lifecycle already-in-status **only** on `POST /update-status` | `400` |

**List:** `GET /api/employees` already returns `jobTitle`, `role`, `status`, `employmentId`. The modal hydrates from there in this version.

**Update Status (sibling):** `POST /api/employee/update-status` is unchanged.

---

## 4. User stories

1. **As an ADMIN:** I want to save Função, Cargo, and Status with one click on the professional section, without calling two endpoints.
2. **As an ADMIN:** I want to set a collaborator's Job Title to "Barbeiro", or clear it, without touching Role or Status.
3. **As an ADMIN:** I want to promote an EMPLOYEE to MANAGER, and be refused if I would leave the platform without a Last Admin.
4. **As a MANAGER:** I want to correct Job Title (and Status, under the lifecycle matrix) of an EMPLOYEE, even if the form echoes the current Cargo.
5. **As a MANAGER:** I want to be refused if I change Cargo, or if I target a MANAGER, an ADMIN, or myself — and I want Job Title left untouched when that happens.
6. **As an operator:** I want Status on this section to follow the same lifecycle rules as the list shortcut, including Vacation and Last Admin.
7. **As an operator:** I want matrícula visible on the form and left unchanged; it is not part of this save.

---

## 5. Edge cases

- **`{}` or only unknown keys / only `employmentId`:** refuse (`400`).
- **`jobTitle` present and empty / `null`:** clear to `null`.
- **`role` or `status` present and empty / `null`:** refuse (`400`).
- **`role` equal to Target:** no-op; MANAGER allowed.
- **`status` equal to Target:** no-op; do not emit already-in-status.
- **`status: REMOVED`:** refuse (`400`). Remove is a different command.
- **MANAGER + different `role`:** `403`; no write of Job Title or Status.
- **MANAGER + Target MANAGER / ADMIN / self:** `403` even for Job Title only.
- **ADMIN + self Job Title:** allowed.
- **ADMIN + self leaving `ADMIN` as Last Admin:** `409`; no write.
- **Last login-capable ADMIN is `VACATION`:** leaving `ADMIN` refused (do not use ACTIVE-only count).
- **Last non-`REMOVED` ADMIN (even `INACTIVE` leftover):** leaving `ADMIN` refused.
- **Promote `INACTIVE` EMPLOYEE to MANAGER:** allowed for ADMIN; Target stays `INACTIVE` unless `status` also changes.
- **Target `REMOVED`:** refuse. Do not overwrite sentinels.
- **Target `INACTIVE` or `VACATION` + Job Title only:** allowed; not Reactivate.
- **EMPLOYEE token:** `403` at the role gate.
- **Actor not login-capable:** `401`. `VACATION` Actor is allowed.
- **Body `id` disagreeing with `:id`:** path wins.
- **Forged `actorId`:** adapter overwrites from the JWT.
- **`password` in the body:** `400`.
- **Role change + Status change in one body:** both policies run; any failure writes nothing.
- **Leftover JWT after Role or Status change:** not revoked here.

---

## 6. Interview analysis (how these rules were reached)

**Why a dedicated professional endpoint.** Main and Personal already each own a PATCH. One save-all would mix identity, PII, Role, and lifecycle. The form is sectioned; the API matches the sections.

**Why Status travels here (and Update Status stays).** The professional form shows Status on the same **Salvar seção**. Two HTTP calls would leave the section half-applied. The use case reuses `EmployeeLifecyclePolicy` so Last Admin and the Actor/Target matrix are not duplicated. The list still inactivates through `POST /update-status`. Status is not reclassified as a professional field.

**Why Role change is ADMIN-only.** Promoting or demoting grants or removes system access. MANAGER is aimed at the floor (`EMPLOYEE`), same as lifecycle.

**Why only a Role / Status *delta* counts.** The form echoes Cargo and Status on every save. Treating presence as intent would 403 a MANAGER who only changed Função, and 400 an operator who only changed Job Title (already-in-status). Comparison happens after the Target is already loaded — no extra I/O. Dedicated Update Status keeps already-in-status as `400` because that call *is* the intent.

**Why Employment Id is out.** Matrícula is a registration number whose Create shape is still open. The form will not send it; this command must not write it.

**Why Job Title is clearable.** It is optional on Create and is not a login key. Blank / `null` clears, like username and personal fields.

**Why Last Admin on leaving ADMIN uses two barriers.** Deactivate protects login-capable ADMINs with an ACTIVE-only count that misses `VACATION`. Leaving the `ADMIN` *role* can empty the platform of login-capable ADMINs (Vacation-only leftover) or of every non-Removed ADMIN. Both counts apply. Promote never needs them.

**Why INACTIVE may receive Job Title / Role.** Same identity as Main/Personal. Changing Role does not skip the Reactivate-or-Remove fork.

**Why JWT is not revoked.** Same Auth sibling as Deactivate and email change. This command must not pretend to own sessions.

**Why frontend labels invert and API does not.** The first UI called the free-text field Cargo. Product now maps Cargo → Role and Função → Job Title. Create and list already persist `jobTitle` and `role`. The inversion is presentation-only.

---

## 7. Open decisions

- **`employmentId` on Create** — registration number format / uniqueness still open. Not this command.
- **Session after Role / Status change** — leftover JWT may keep the old role until Auth re-checks. Same known limitation as lifecycle and Main Data.
- **Get-by-id** — modal hydrates from the list in this version.
- **Login-capable ADMIN count port** — `countActiveAdmins` is ACTIVE-only. Leaving ADMIN needs `ACTIVE | VACATION` (plus existing `countNonRemovedAdmins`). Design Doc owns the port shape.

---

## 8. Acceptance criteria (minimum)

- [ ] ADMIN + Target EMPLOYEE + `{ "jobTitle": "Barbeiro" }` → `200 { data: { id } }`; role and status unchanged.
- [ ] `{ "jobTitle": "" }` or `{ "jobTitle": null }` → Job Title becomes `null`; other fields unchanged.
- [ ] ADMIN + `{ "role": "MANAGER" }` on an EMPLOYEE → role persisted; Last Admin guards not applied.
- [ ] ADMIN + Last Admin leaving `ADMIN` → `409`; no write.
- [ ] Last login-capable ADMIN is `VACATION` + leaving `ADMIN` → `409`.
- [ ] MANAGER + Target EMPLOYEE + echoed current `role` + new `jobTitle` → `200`; Job Title persisted.
- [ ] MANAGER + Target EMPLOYEE + **different** `role` → `403`; Job Title / status not persisted.
- [ ] MANAGER + Target MANAGER / ADMIN / self → `403`.
- [ ] EMPLOYEE token → `403`.
- [ ] `{ "status": "INACTIVE" }` when Target is `ACTIVE` → lifecycle policy + persist status/`deactivateAt` (ADMIN/MANAGER per matrix).
- [ ] `{ "status": "ACTIVE" }` when Target is already `ACTIVE` → `200`; no already-in-status error; no write unless Job Title also present.
- [ ] `{ "status": "REMOVED" }` → `400`; no write.
- [ ] `POST /api/employee/update-status` with the same status as current still → `400`.
- [ ] Target `REMOVED` → `409`.
- [ ] Target `INACTIVE` + Job Title or Role patch → allowed; not Reactivate.
- [ ] `{}` or only unknown keys → `400`.
- [ ] `password` in the body → `400`.
- [ ] Body cannot spoof `actorId`; Target id is `:id`.
- [ ] Persistence writes only the fields that changed (no full document / redacted password / no `employmentId`).
- [ ] Role-delta refusal or lifecycle refusal → no partial write.
