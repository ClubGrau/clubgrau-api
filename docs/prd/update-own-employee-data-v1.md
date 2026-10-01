# PRD: Update Own Employee Data

**Product Requirements Document**
**Date:** 30/09/2026 | **Status:** Design ready | **Version:** 1.0

**Glossary:** [`src/modules/employees/CONTEXT.md`](../../src/modules/employees/CONTEXT.md)
**Design:** [`docs/design-docs/update-own-employee-data-v1.md`](../design-docs/update-own-employee-data-v1.md)
**Sibling (Main Data):** [`docs/prd/update-employee-v1.md`](./update-employee-v1.md)
**Sibling (Personal Data):** [`docs/prd/update-personal-employee-data-v1.md`](./update-personal-employee-data-v1.md)
**Sibling (Professional Data):** [`docs/prd/update-professional-employee-data-v1.md`](./update-professional-employee-data-v1.md)
**Sibling (lifecycle):** [`docs/prd/employee-lifecycle-v1.md`](./employee-lifecycle-v1.md)
**Auth sibling:** [`docs/prd/password-reset-v1.md`](./password-reset-v1.md)

This document specifies the **Profile Card** write and its hydration query: **Update Own Employee Data** and **Get Own Employee**. A login-capable collaborator corrects their own name, phone, username, and Personal Employee Data in one save. It does **not** change email, password, status, role, or professional fields, and it is **not** Edit Collaborator.

---

## 1. Overview and objective

Club Grau already corrects a **Target** through sectioned Edit Collaborator PATCHes. Those commands refuse an `EMPLOYEE` Actor and refuse `MANAGER` + self. The Profile Card is a different surface: one **Atualizar Dados** button, the logged-in person, Main Employee Data **except email** plus Personal Employee Data.

List cannot hydrate this card. `GET /api/employees` is `ADMIN` | `MANAGER`. The Session Token does not carry phone, username, or personal fields.

**Objective:** one sparse **PATCH** that writes only the Own Employee Data fields present in the body, Target always equal to the Actor from the Session Token; plus one **GET** that returns the Actor's list read model so the Front can lazy-load the card.

**Non-goals (this version):**

- Edit Collaborator routes, matrices, or policies (`EmployeeMainDataPolicy`, `EmployeePersonalDataPolicy`, `EmployeeProfessionalDataPolicy`)
- Email on this write — including ADMIN self. Email stays on `PATCH /api/employee/:id/main-data`
- Professional fields, `status`, `password`, `employmentId`
- Get employee by id of **another** collaborator
- Revoking or reissuing the Session Token when `name` changes
- Authenticated change-password (Auth)
- Fetching the card at application boot — the Front lazy-loads when the card is needed

---

## 2. Business rules (core logic)

### Rule 2.1 — Profile Card is not Edit Collaborator

| Surface | Command | v |
|---------|---------|---|
| Edit Collaborator — Dados principais | Update Main Employee Data | shipped |
| Edit Collaborator — Informações pessoais | Update Personal Employee Data | shipped |
| Edit Collaborator — Informações profissionais | Update Professional Employee Data | shipped |
| **Profile Card** | **Update Own Employee Data** + **Get Own Employee** | **this PRD** |

Use case name in the hexagon: `UpdateOwnEmployeeDataUsecase`. Query: `GetOwnEmployeeQuery`.

The card is one save. The API is one PATCH. Two HTTP calls (Main then Personal, or two new self-service endpoints) are out: a failure on the second call would leave the card half-applied.

### Rule 2.2 — Own Employee Data (writable)

**Writes:** `name`, `phone`, `username`, `gender`, `languages`, `emergencyContact`, `nif`, `address`.

**Never writes:** `email`, `password`, `status`, `role`, `jobTitle`, `employmentId`.

`username` has no uniqueness rule (same as Update Main Employee Data). Any login-capable Actor may change their own username.

### Rule 2.3 — Email never changes here

`email` in the PATCH body is **ignored** and is never persisted. A client may echo it from GET (disabled field). Changing email remains Update Main Employee Data, under the existing Actor/Target matrix. `EMPLOYEE` and `MANAGER` do not change email via the Profile Card. `ADMIN` also does not change email via this command — they use Edit Collaborator.

### Rule 2.4 — Sparse PATCH; same clear rules as the operator commands

Only writable keys **present** in the body are corrected. Omitted writable keys stay as they are. Ignored keys do not count as a field to correct.

| Field | If omitted | If present + valid | If present + `null` / blank / whitespace |
|-------|------------|-------------------|------------------------------------------|
| `name` | unchanged | stores | `400` — do not clear |
| `phone` | unchanged | `Phone` VO → stores | `400` — do not clear |
| `username` | unchanged | stores | **clear** to `null` |
| `gender` | unchanged | enum → stores | **clear** to `null` |
| `languages` | unchanged | stores string | **clear** to `null` |
| `emergencyContact` | unchanged | `Phone` VO → stores | **clear** to `null` |
| `nif` | unchanged | `Nif` VO → stores | **clear** to `null` |
| `address` | unchanged | stores string | **clear** to `null` |

Body with none of the eight writable keys (`{}`, only ignored keys, or only `email`) → `400` (nothing to correct).

`gender` accepts only `male` | `female` | `other` (same as Update Personal Employee Data). Non-null invalid → `400`. `languages` stays a free string. `nif` may arrive as string or number (same coercion as Personal). `emergencyContact` is a phone string only.

### Rule 2.5 — Authority: login-capable self only

There is no Actor/Target matrix of roles. The Target **is** the Actor.

| Actor role | May call GET / PATCH on self | May call on anyone else |
|------------|------------------------------|-------------------------|
| `EMPLOYEE` | yes | no path to another Target |
| `MANAGER` | yes | no — Edit Collaborator stays the operator surface |
| `ADMIN` | yes | no on this command — Edit Collaborator stays |

- Actor must be **login-capable** (`ACTIVE` or `VACATION`) on **both** GET and PATCH. Leftover Session Token after `INACTIVE` or `REMOVED` → `401` on both. Domain enforces this; do not wait on the Auth middleware sibling.
- Actor identity comes from the Session Token, never from the body and never from a path `:id`.
- HTTP gate: `authTokenMiddleware` only. **No** `requireRoles('ADMIN', 'MANAGER')`. `EMPLOYEE` must pass the route.
- No Actor password (step-up). `password` in the body is ignored and never written.

A new policy (`EmployeeOwnDataPolicy`) owns this. Do **not** widen `EmployeeMainDataPolicy` or `EmployeePersonalDataPolicy` to allow self-service.

### Rule 2.6 — Persist only Own Employee Data; one write

Evaluate validation, then `$set` only the writable keys that are present. Any refusal → no `$set`. Do not rewrite `email`, `password`, `status`, `role`, `jobTitle`, `employmentId`, `deactivateAt`, `removedAt`. Do not persist a full `toJSON()` snapshot.

### Rule 2.7 — Get Own Employee hydrates the card

`GET /api/employee/me` returns the same read model as a list item (`GetEmployeesItemDto`): identity, personal, professional display fields, status, timestamps. **No `password`.**

The Front calls this when the Profile Card needs data (lazy), not on every boot. One GET is the full card payload so lazy load is not N requests.

Email, `role`, `status`, `jobTitle`, and `employmentId` on GET are for **display**. PATCH still does not write them.

### Rule 2.8 — PATCH success returns the same read model

`200` on PATCH returns the Actor's read model **after** the write (same shape as GET). The Front updates the lazy cache without a second GET.

This command does not revoke or reissue a Session Token. `name` (and other claims) on an existing JWT may stay stale until the next login. Same class of Auth gap as email change on Update Main Employee Data.

---

## 3. Data contracts and dependencies

This command and query live on the employees hexagon. They do not wait on other modules. They do not wait on Get-by-id of another collaborator.

**HTTP:**

```http
GET /api/employee/me
Authorization: Bearer <Actor token>
```

```http
PATCH /api/employee/me
Authorization: Bearer <Actor token>
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "+351 912 345 678",
  "username": "joao",
  "gender": "male",
  "languages": "Português",
  "emergencyContact": "+351 912 345 678",
  "nif": "123456789",
  "address": "Rua do Grau, 10, Lisboa"
}
```

Do not send `id` or `actorId` in the body. The adapter overwrites any forged `actorId` with the JWT id. A body `id` is ignored; there is no path Target.

Success (GET and PATCH): `200` with `{ data: <GetEmployeesItemDto> }` of the Actor (no `password`).

Route: `authTokenMiddleware` + `adaptRoute`. No role allowlist.

| Situation | HTTP |
|-----------|------|
| GET / PATCH, Actor missing, not found, or not login-capable | `401` |
| PATCH with no writable field | `400` |
| `name` / `phone` present and blank / `null` | `400` |
| Invalid `gender` (non-null, not in enum) | `400` |
| Invalid `emergencyContact` / `phone` format | `400` |
| Invalid `nif` format / check digit | `400` |
| Invalid `name` VO | `400` |
| Unexpected | `500` |

There is no `403` product path on this command: the only legal Target is the Actor, and role is not a gate. There is no `409` occupancy path: email is not written.

Unknown keys, including `email` / `password` / `status` / `role` / `jobTitle` / `employmentId`, are ignored. Body with only those keys → `400`.

**List / Edit Collaborator:** unchanged. `GET /api/employees` stays `ADMIN` | `MANAGER`. Operator PATCHes stay on `/api/employee/:id/…`.

**Auth:** login stays email + password. This feature does not change JWT claims, `sessionVersion`, or middleware live-status checks.

---

## 4. User stories

1. **As an EMPLOYEE:** I want to open my Profile Card and see my current data, loaded only when I open it, without using the collaborators list.
2. **As an EMPLOYEE:** I want to correct my phone, username, or address with one **Atualizar Dados**, without changing my email.
3. **As a MANAGER:** I want to update my own name and personal data from the card, because Edit Collaborator refuses MANAGER + self.
4. **As an ADMIN:** I want the same self-service card, and I still change email only on Edit Collaborator.
5. **As any login-capable collaborator:** I want a failed NIF validation to write nothing (name and personal stay as they were).
6. **As any login-capable collaborator:** I want the save response to refresh the card cache without a second GET.
7. **As an operator:** I want Edit Collaborator matrices unchanged so an EMPLOYEE token still cannot PATCH another person's `/main-data` or `/personal-data`.

---

## 5. Edge cases

- **PATCH `{}` or only ignored keys (`email`, `role`, `foo`):** refuse (`400`); no write.
- **`email` present and different from current:** ignore; email unchanged; other present writable keys still apply.
- **`name: ""` or `phone: null`:** `400`; no write.
- **`username: ""` / `username: null`:** clear username; other writable fields follow presence.
- **`{ "address": null }`:** clears address; other fields unchanged.
- **`gender: "invalid"`:** `400`; no write.
- **`nif` as JSON number:** coerce to string before `Nif.create`, same as Personal.
- **`VACATION` Actor:** GET and PATCH allowed.
- **Leftover JWT, Actor `INACTIVE` or `REMOVED`:** `401` on GET and PATCH; no read model, no write.
- **Body `id` of another collaborator:** ignored; write still applies to the JWT Actor.
- **Forged `actorId`:** adapter overwrites from the JWT.
- **`password` / `status` / `role` in the body:** ignored; never written.
- **EMPLOYEE calling `PATCH /api/employee/:id/main-data`:** still `403` (unchanged). This PRD does not open those routes.
- **Stale JWT `name` after a successful name PATCH:** token is not reissued here.

---

## 6. Interview analysis (how these rules were reached)

**Why one command, not two PATCHes.** The Profile Card has one save. Edit Collaborator is sectioned, so those writes are sectioned. A second HTTP call can succeed after the first and leave the card half-applied — the same reason professional Função + Cargo + Status share one PATCH.

**Why a new command, not opening Main/Personal to self.** Those policies are operator-on-Target. Widening them would mix self-service with the floor matrix, or require `if (self)` inside classes that Personal already said must not absorb this. `UpdateOwnPersonalData` as predicted in that PRD is too narrow: Main-without-email is in the same button.

**Why every login-capable role, self only.** The card is whoever is logged in. MANAGER has no Edit Collaborator path to self. EMPLOYEE has no operator path at all. ADMIN keeps two surfaces; email stays on the operator one.

**Why email is ignored, not `400`.** GET returns email for display. Disabled fields often travel on submit. The product rule is “does not change”, not “must not appear in JSON”. Occupancy never runs here.

**Why Target has no `:id`.** There is no other Target. A path id is a spoof surface with no product use. Same rule as “never trust `actorId` in the body”.

**Why GET is in this PRD.** List is not available to EMPLOYEE. JWT is not a PII dump. Lazy load still needs one payload when the card opens.

**Why GET uses the list read model.** One round-trip covers save fields and read-only context (email, role, matrícula, status). A slimmer DTO would break the first display-only label.

**Why PATCH returns that read model.** The cache lives on the card, not on the list. `{ id }` would force a refetch or a fragile client merge of a sparse body.

**Why the same clear rules as operator PATCHes.** Empty phone does not mean two different things on two surfaces. Username and personal fields stay clearable; name and phone stay required-if-present.

**Why no step-up.** Password is not part of these updates. This is not Remove. The Session Token already authenticates; the policy already limits the write to self.

**Why leftover `INACTIVE` JWT is `401` on GET too.** Who cannot authenticate does not use the card. `VACATION` remains a full session, as in login.

**Why JWT is not reissued.** Same Auth sibling as Deactivate and email change. This command must not pretend to own sessions.

---

## 7. Open decisions

- **Design Doc** — hexagon seams, reuse of patch services vs a dedicated own-data patch, repository `$set` vs composing existing outbound ports. Out of this PRD.
- **Session after name change** — leftover JWT may keep the old `name` claim until re-login. Auth hexagon.
- **Live status on `authTokenMiddleware`** — still a known Auth sibling. This feature refuses non-login-capable Actors in the employees domain.
- **Get employee by id (other Target)** — still a follow-up query of its own. Get Own Employee does not replace it.
- **`languages` / `emergencyContact` shape** — unchanged (`string | null`; phone-only emergency contact).
- **Username uniqueness** — still absent.

The Personal Data PRD open decision “future `UpdateOwnPersonalDataUsecase`” is **superseded** by this command.

---

## 8. Acceptance criteria (minimum)

- [ ] Login-capable `EMPLOYEE` + `GET /api/employee/me` → `200` with list-shaped read model, no `password`.
- [ ] Login-capable `MANAGER` / `ADMIN` + same GET → `200` of **self**, not a list.
- [ ] Front may skip GET until the Profile Card is opened (lazy); the API does not require a GET before PATCH, but the card hydrates from GET.
- [ ] `EMPLOYEE` + `PATCH` `{ "phone": "+351 912 345 678" }` → `200` with updated read model; email unchanged.
- [ ] `{ "username": "" }` → username `null`; other fields unchanged.
- [ ] `{ "name": "" }` or `{ "phone": "" }` → `400`; no write.
- [ ] `{ "email": "other@example.com", "address": "Rua B" }` → address persisted; email unchanged.
- [ ] `{ "email": "other@example.com" }` only → `400`; no write.
- [ ] `{ "gender": "invalid" }` → `400`; no write.
- [ ] `{ "nif": null }` → NIF cleared; other fields unchanged.
- [ ] Body with `name` + invalid `nif` → `400`; **name not persisted**.
- [ ] `{}` or only unknown / ignored keys → `400`.
- [ ] `VACATION` Actor → GET and PATCH allowed.
- [ ] Actor `INACTIVE` or `REMOVED` (leftover JWT) → `401` on GET and PATCH.
- [ ] No `requireRoles('ADMIN', 'MANAGER')` on these two routes; `EMPLOYEE` is not `403` here.
- [ ] `PATCH /api/employee/:id/main-data` and `…/personal-data` still refuse `EMPLOYEE` and refuse `MANAGER` + self.
- [ ] Body cannot spoof `actorId`; there is no Target `:id`.
- [ ] Persistence writes only present writable keys (no email, no password, no status, no role, no jobTitle, no employmentId).
- [ ] PATCH `200` body is the same read model as GET (post-write).
- [ ] Session Token is not reissued on success.
