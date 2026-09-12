# PRD: Employee Lifecycle — Deactivate, Reactivate, Remove

**Product Requirements Document**
**Date:** 21/08/2026 | **Revised:** 31/08/2026 (login-capable = `ACTIVE` \| `VACATION`) | **Status:** Ready for Design Doc | **Version:** 1.1

**Glossary:** [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md)
**ADRs:** [`docs/adr/remove-or-inactivate-emp/`](../adr/remove-or-inactivate-emp/)

This document specifies taking a collaborator off the operational floor (**Deactivate**), bringing the same person back (**Reactivate**), and taking them off the platform (**Remove** via **Anonymize**). It does **not** specify payroll, commissions, or any other module that may later store `employeeId`. Those topics remain with the domain expert.

---

## 1. Overview and objective

Club Grau already has `ACTIVE` / `INACTIVE` / `VACATION` and `POST /api/employee/update-status`. That command is operational stop and resume. It is **not** leaving the platform: the document stays, the email stays occupied, the person can come back as the same identity.

Operators also need a real **Remove**: the person disappears from the collaborators list, the original email can be used on a new Create, and personal data is not kept in the clear. The `_id` must still exist so any current or future record keyed by `employeeId` does not dangle.

**Objective:** one clear fork on an already-`INACTIVE` collaborator — Reactivate **or** Remove — with role rules, Last Admin protection, and step-up confirmation (Actor password).

**Non-goals (this version):**

- Hard delete of the Mongo document
- Audit UI / list filter for `REMOVED`
- Revoking JWTs on Deactivate or Remove (Auth sibling)
- Create-employee authorization matrix (who may create which role)
- Behaviour of any downstream module when it sees a `REMOVED` `employeeId`

Login and session for `VACATION` belong in Auth ([Password Reset PRD](./password-reset-v1.md)). This document only records the consequence for Last Admin and Actor (Rule 2.5).

---

## 2. Business rules (core logic)

### Rule 2.1 — Deactivate is not Remove

| Intent | Status | Identity | Email | List | How to undo |
|--------|--------|----------|-------|------|-------------|
| Deactivate | `INACTIVE` | same | occupied | yes | Reactivate |
| Remove | `REMOVED` | same `_id`, PII wiped | original email free | no | none (new Create is a new id) |

`VACATION` is operational, not this fork. Remove is never offered from `ACTIVE` or `VACATION`.

### Rule 2.2 — The INACTIVE screen is the fork

Experience: the collaborator **is already inactivated** → the operator is asked whether to **Reactivate** or **Remove**.

- **MANAGER** on an `INACTIVE` **`EMPLOYEE`**: Reactivate only.
- **ADMIN** on `INACTIVE` (any role, except Last Admin constraints on Remove): Reactivate **or** Remove.

Remove is not a control on `ACTIVE` / `VACATION` profiles.

### Rule 2.3 — Remove is Anonymize (keep the id)

Remove does not `deleteOne`. After success:

| Field | After Anonymize |
|-------|-----------------|
| `_id` / `employeeId` | unchanged |
| `status` | `REMOVED` (terminal; not a value of `update-status`) |
| `name` | sentinel that satisfies `Name` (e.g. `Removed`) |
| `email` | unique sentinel `removed.{id}@anonymized.invalid` |
| `phone` / `nif` | `null` |
| `password` | new unusable hash (random secret) |
| `role` | unchanged (audit / Last Admin counting **ignores** `REMOVED`) |
| `removedAt` | now |
| `deactivateAt` | left as set by the prior `INACTIVE` transition |

`REMOVED` is not a legal body value for `POST /api/employee/update-status`.

### Rule 2.4 — Authority matrix

`EMPLOYEE` operates on nobody. Hiding buttons is not enough; the API enforces the matrix.

| Actor ↓ / Target → | EMPLOYEE | MANAGER | ADMIN |
|--------------------|----------|---------|-------|
| EMPLOYEE | refuse | refuse | refuse |
| MANAGER | Deactivate / Reactivate | refuse | refuse |
| ADMIN | Deactivate / Reactivate / Remove | same | same (Last Admin: Rule 2.5) |

Remove Actor is always ADMIN. MANAGER never Deactivate / Reactivate / Remove an ADMIN or a peer MANAGER. ADMIN lifecycle stays among ADMINs.

### Rule 2.5 — Last Admin stays login-capable

**Last Admin (operational):** the only collaborator with role `ADMIN` whose status is login-capable (`ACTIVE` or `VACATION`). That person cannot become `INACTIVE` while they remain the only ADMIN who can log in. An ADMIN on `VACATION` **does** count as a second login-capable ADMIN. The Last Admin **may** go on `VACATION` — they keep a full session.

**Last Admin (Remove / legacy):** the only collaborator with role `ADMIN` who is not `REMOVED`. That identity cannot be Removed; Reactivate by another ADMIN is the recovery path if such a row already exists.

Self-Remove is already impossible: Actor must be login-capable and Target must be `INACTIVE`. Real-world time off does not lock the platform: `VACATION` can still log in, reset a password, and act as Actor.

### Rule 2.6 — Actor password (step-up)

Remove request: Target `id` + Actor password. Identity of the Actor comes from the JWT, never from the body.

The modal asks only for that password. No second password field, no typing the Target’s name. Copy states: irreversible; disappears from the list; original email becomes free; a later Create with that email is a **new** identity and does not inherit history bound to the `REMOVED` id.

Wrong password: same opacity as login (no leak of “wrong password” vs “unknown user”). No extra lockout in this version.

### Rule 2.7 — Email occupancy

- `INACTIVE`: original email still occupied. Create with that email remains blocked (`EmployeeInactiveError` today). Fork: Reactivate this person **or** Remove, then Create.
- `REMOVED`: original email is free. Create succeeds as a **new** `employeeId`. Nothing stored against the old id moves to the new one.

A person who returns to the salon must be **Reactivated**, not Removed and created again.

### Rule 2.8 — List

`GET /api/employees` never returns `REMOVED`. No `status=REMOVED` filter in this version.

---

## 3. Data contracts and dependencies

Remove is a new command on the employees hexagon. It does not wait on other modules.

**HTTP (planned):**

```http
POST /api/employee/remove
Authorization: Bearer <Actor token>
{ "id": "<Target id>", "password": "<Actor password>" }
```

Success: `200` with `{ id }` of the Target. The HTTP adapter must pass `actorId` from the decoded token into the use case. The body must not accept `actorId`.

**Auth (sibling, not this command):** login accepts `ACTIVE` and `VACATION`; refuses `INACTIVE` and `REMOVED` (same opaque error). Existing JWTs are not revoked here. Product rule “inactive / removed must not keep using the API” belongs in Auth (re-check current status after decode; `VACATION` remains a valid session).

**Other modules:** may hold `employeeId`. This PRD only guarantees the id still exists after Remove. What they do with `REMOVED` is out of scope.

---

## 4. User stories

1. **As a MANAGER:** I want to Deactivate an `EMPLOYEE` so they stop working but can still be brought back, without being able to take them off the platform.
2. **As a MANAGER:** on an `INACTIVE` `EMPLOYEE`, I want to Reactivate them so the same person returns with the same identity.
3. **As an ADMIN:** on an `INACTIVE` collaborator, I want to choose Reactivate **or** Remove, confirming Remove with **my** password.
4. **As an ADMIN:** after Remove, I want that person gone from the collaborators list and their former email available for a new hire who is **not** the same identity.
5. **As an ADMIN:** I want to Deactivate / Reactivate / Remove a MANAGER or another ADMIN (except Last Admin), because those levels stay among ADMINs.
6. **As the Last Admin:** I must not be Deactivated or Removed until another login-capable ADMIN exists, so the platform is never left without an ADMIN who can log in. I **may** go on `VACATION` — that is still a login.

---

## 5. Edge cases

- **Remove while `ACTIVE` / `VACATION`:** refuse. Deactivate first.
- **Remove while already `REMOVED`:** refuse (`EmployeeNotFoundError` or equivalent — do not distinguish “never existed” from “already removed” on the list path; by id, treat as not found or already removed without leaking extra detail).
- **MANAGER Remove, or MANAGER acting on MANAGER/ADMIN:** refuse even if the client sends the request.
- **EMPLOYEE calling lifecycle endpoints:** refuse.
- **Last Admin** Deactivate / Remove: refuse, with a clear reason that another login-capable ADMIN must exist first. Last Admin **Vacation:** allowed.
- **Wrong Actor password:** generic credentials failure; do not persist Anonymize.
- **Actor not login-capable (`INACTIVE` / `REMOVED`):** refuse (stale JWT after someone inactivated the Actor). `VACATION` Actor is allowed.
- **Email Create while Target still `INACTIVE`:** still blocked; operator must Reactivate or Remove first.
- **Same email after Remove:** new Create does not inherit the old id or its history.
- **Target is Last Admin but `INACTIVE` (legacy data):** cannot Remove; Reactivate (by another ADMIN) is the recovery path if such a row already exists. This version must not create that state going forward (Rule 2.5).

---

## 6. Interview analysis (how these rules were reached)

These scenarios were walked during the grilling session. They are the rationale, not extra product scope.

**Anonymize vs hard delete.** Hard delete would drop `_id`. Any record in another context keyed by `employeeId` would dangle. Anonymize keeps the id, wipes PII, frees the email. Downstream modules are **not** specified here.

**Whose password.** Create uses `password` + `passwordConfirmation` for the **new** employee. Remove uses the **Actor’s** password (step-up). The Target’s password is unknown to a manager/admin and must not be required. The JWT already identifies the Actor; the password proves they are still at the keyboard. The HTTP adapter must supply `actorId` from the token; the client must not send it.

**Why only from INACTIVE.** `INACTIVE` is the fork: same person comes back (Reactivate) vs they leave the platform (Remove). Offering Remove from `ACTIVE` skips an explicit operational stop and makes accidents easier.

**Why MANAGER cannot Remove.** Remove wipes PII and is irreversible. MANAGER runs the floor (Deactivate / Reactivate `EMPLOYEE`). ADMIN is the highest level; ADMIN matters stay among ADMINs.

**Why MANAGER cannot act on MANAGER or ADMIN.** “MANAGER is aimed at employees.” Peer-manager conflict and all ADMIN lifecycle escalate to ADMIN. Today’s `update-status` (any token, any target) is **stricter** after this PRD.

**Why Last Admin cannot become `INACTIVE` (but may go on `VACATION`).** After the matrix, a MANAGER cannot Reactivate an ADMIN. Login accepts `ACTIVE` and `VACATION` only. If the only login-capable ADMIN became `INACTIVE`, leftover `INACTIVE` ADMINs do not restore login — nobody with permission could bring them back. `VACATION` does not create that lockout: the person can still log in, reset a password, and act as Actor. Fix: Last Admin stays login-capable until a second login-capable ADMIN exists. They may take vacation alone. This supersedes the earlier “Last Admin must stay `ACTIVE` / cannot go on `VACATION`” rationale (ADRs 0008 and 0009).

**Why `REMOVED` is absent from the list.** Sentinels would look like real people and confuse Reactivate vs Create.

**Why a new Create does not inherit history.** Two people (or a return vs a new hire) must not share one career on the same id. Return path is Reactivate. Remove+Create is a new identity. Whatever another module later stores against `employeeId` stays on the `REMOVED` id — that module’s rules are a separate domain-expert decision.

**Self-Remove.** Actor `ACTIVE` + Target `INACTIVE` ⇒ they cannot be the same person. Still reject `actorId === targetId` as belt-and-braces.

**Step-up vs typing the name.** Password already gates a stolen open session. Typing the Target’s name adds friction without replacing step-up. Modal copy carries the irreversibility warning.

---

## 7. Acceptance criteria (minimum)

- [ ] `INACTIVE` `EMPLOYEE` + MANAGER → Reactivate succeeds; Remove is refused.
- [ ] `INACTIVE` `EMPLOYEE` + ADMIN + correct Actor password → Remove anonymizes; list no longer includes them; original email can be used on Create as a new id.
- [ ] `INACTIVE` + ADMIN + wrong password → no write; generic error.
- [ ] `ACTIVE` / `VACATION` + Remove → refused.
- [ ] MANAGER + Target `MANAGER` or `ADMIN` (Deactivate / Reactivate / Remove) → refused.
- [ ] Last Admin + Deactivate or Remove → refused; Last Admin + Vacation → allowed.
- [ ] Two ADMINs: ADMIN A may Remove ADMIN B if B is `INACTIVE` and A remains a non-`REMOVED` ADMIN.
- [ ] Body cannot spoof `actorId`; Actor is taken from the JWT.
- [ ] `update-status` still does not accept `REMOVED` as a status payload.
