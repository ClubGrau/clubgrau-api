# Employees

Identity and lifecycle of a collaborator on the Club Grau platform. This context owns the employee record; other contexts reference a collaborator by id only.

## Language

**Edit Collaborator**:
The product surface that corrects an existing collaborator's data in sections (main, personal, professional). It is not one write of the whole record and never includes password.
_Avoid_: update employee, update profile, patch, save all fields at once

**Main Employee Data**:
The primary identity fields of a collaborator: full name, email, phone, and username.
_Avoid_: profile, personal information, professional information

**Update Main Employee Data**:
The command that corrects only the Main Employee Data fields present in the request. Omitted fields stay as they are. EMPLOYEE acts on nobody. MANAGER may edit only EMPLOYEE. ADMIN may edit any role, including self. The Target must not be Removed. Status, password, role, and personal/professional fields are unchanged. Email occupancy is the same as Create, except the Target's current email is not a collision.
_Avoid_: Edit Collaborator as this command's name, update employee, update profile, steal an INACTIVE email, require the whole section

**Email occupancy**:
An email is taken while a non-Removed collaborator holds it. Create and Update Main Employee Data refuse a taken email. Removed frees the original address.
_Avoid_: unique username, inheriting an INACTIVE email

**Deactivate**:
Operational stop. Status becomes `INACTIVE`; identity and email remain. MANAGER may Deactivate only `EMPLOYEE`. ADMIN may Deactivate `EMPLOYEE`, `MANAGER`, and `ADMIN`, except the Last Admin.
_Avoid_: delete, remove, excluir

**Reactivate**:
Restore of the same identity: `INACTIVE` → `ACTIVE` on the same `employeeId`, including any history already bound to that id. MANAGER may Reactivate only `EMPLOYEE`. ADMIN may Reactivate any role. EMPLOYEE Reactivates nobody. A person who returns to the salon takes this path, not Remove+Create.
_Avoid_: create again, undelete, reopen account, Remove+Create

**Remove**:
Intent to take a collaborator off the platform. Only an ADMIN may execute it, and only from `INACTIVE`. The implementation is Anonymize, never deleting the document.
_Avoid_: delete, destroy, hard delete

**Anonymize**:
Replacement of personal data with sentinels, keeping `_id`, setting terminal status `REMOVED`, and freeing the original email.
_Avoid_: hard delete, erase identity, GDPR erase of the id

**Actor**:
The login-capable collaborator identified by the session, never by the request body, who executes a command on a Target. Who may act depends on the command: Remove is ADMIN-only; Update Main Employee Data allows ADMIN on any Target and MANAGER on EMPLOYEE only.
_Avoid_: Target password, forged actorId, Actor must be ACTIVE-only

**Login-capable**:
Status from which a collaborator may authenticate and hold a full session: `ACTIVE` or `VACATION`. `INACTIVE` and `REMOVED` are not login-capable.
_Avoid_: isActive, enabled, not deactivated, ACTIVE-only session

**Target**:
The existing collaborator whose record a command addresses. Role and status constrain what is allowed; they do not identify the Actor. Update Main Employee Data allows `ACTIVE`, `VACATION`, and `INACTIVE`, and refuses Removed. Remove still requires `INACTIVE`.
_Avoid_: victim, user, account

**Removed**:
Terminal state after Anonymize. Absent from the collaborators list. The `employeeId` remains so other contexts can still point at that identity.
_Avoid_: deleted, hidden, archived, inactive

**Last Admin**:
The only `ADMIN` who is login-capable (`ACTIVE` or `VACATION`), or — for Remove — the only `ADMIN` who is not `REMOVED`. Cannot become `INACTIVE` while they are the last login-capable ADMIN; leftover `INACTIVE` ADMINs do not count as a second login. An ADMIN on `VACATION` still counts. May go on `VACATION` even as Last Admin. Cannot be Removed while they are the last non-`REMOVED` ADMIN.
_Avoid_: last user, only login, must stay ACTIVE, Last Admin cannot take vacation
