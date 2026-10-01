# Employees

Identity and lifecycle of a collaborator on the Club Grau platform. This context owns the employee record; other contexts reference a collaborator by id only.

## Language

**Edit Collaborator**:
The product surface that corrects an existing collaborator's data in sections (main, personal, professional). It is not one write of the whole record and never includes password.
_Avoid_: update employee, update profile, patch, save all fields at once, Profile Card

**Profile Card**:
The product surface where a login-capable collaborator views and corrects their own Main Employee Data except email, plus Personal Employee Data, in one save. The Front loads it on demand, not from the collaborators list.
_Avoid_: Edit Collaborator, update profile as a command name, hydrating from list, changing email here

**Get Own Employee**:
The query that returns the Actor's collaborator read model (same shape as a list item, without password) so the Profile Card can hydrate. The Actor must be login-capable. There is no other Target.
_Avoid_: get employee by id, list, putting personal fields in the Session Token

**Update Own Employee Data**:
The command that corrects the Actor's own name, phone, username, and Personal Employee Data in one sparse PATCH. Username and Personal Employee Data clear to null when present and blank. Name and phone do not. Email, password, status, role, job title, and employment id are not written. Any login-capable role may call it, only on self.
_Avoid_: Update Own Personal Data, Update Main Employee Data, Edit Collaborator, requiring email, path :id, operator matrix, treating blank username as a missing required field

**Main Employee Data**:
The primary identity fields of a collaborator: full name, email, phone, and username.
_Avoid_: profile, personal information, professional information

**Update Main Employee Data**:
The command that corrects only the Main Employee Data fields present in the request. Omitted fields stay as they are. Username present and blank or null clears to null. Name, email, and phone present and blank or null are refused. EMPLOYEE acts on nobody. MANAGER may edit only EMPLOYEE. ADMIN may edit any role, including self. The Target must not be Removed. Status, password, role, and personal/professional fields are unchanged. Email occupancy is the same as Create, except the Target's current email is not a collision.
_Avoid_: Edit Collaborator as this command's name, update employee, update profile, steal an INACTIVE email, require the whole section, treating blank username as a missing required field

**Personal Employee Data**:
The personal profile fields of a collaborator: gender, languages, emergency contact, NIF, and address. All are optional and clearable to null. None is a login key or business identity anchor.
_Avoid_: personal information, profile, main data

**Update Personal Employee Data**:
The command that corrects only the Personal Employee Data fields present in the request. All five fields are clearable (present + null/blank → null). EMPLOYEE acts on nobody. MANAGER may edit only EMPLOYEE. ADMIN may edit any role, including self. The Target must not be Removed. Main Data, status, password, role, and professional fields are unchanged. No occupancy check (no uniqueness constraint on personal fields).
_Avoid_: update profile, update personal information, require all five fields, treat null as an error

**Job Title**:
The free-text name of the collaborator's function on the floor (e.g. Barbeiro). Optional and clearable to null. The API field is `jobTitle`. The frontend may label this Função.
_Avoid_: role, cargo in the API, treating it as an enum, requiring a placeholder to empty the field

**Role**:
The system-access enum of a collaborator: `ADMIN`, `MANAGER`, `EMPLOYEE`. The API field is `role`. Only an ADMIN may change it; sending the Target's current role is not a change. The Last Admin cannot leave `ADMIN`. The frontend may label this Cargo.
_Avoid_: função in the API, job title, cargo as free text, treating an unchanged role as a promotion

**Employment Id**:
The collaborator's registration number (`employmentId`). Create issues it: a positive integer from 1, no leading zeros, stored as a digit string. The client does not supply it; a value sent on Create is ignored. Issued numbers are unique and are not reused, including after Remove. A gap may remain when issuance succeeds and the employee insert does not. No later command rewrites it. Update Professional Employee Data does not write it. Remove keeps it.
_Avoid_: client-supplied matrícula, updating matrícula on professional save, treating it as Job Title, reusing a number after Remove, backfilling legacy values

**Professional Employee Data**:
The professional fields of a collaborator that this command may correct: job title and role. Employment id belongs to the professional record but is not writable here. Status is not a professional field; it is a lifecycle action that may travel in the same save.
_Avoid_: professional information, cargo as job title in the API, função as role in the API, patching employment id

**Update Professional Employee Data**:
The command that corrects job title and, when allowed, role, plus a status change through the existing lifecycle rules when status is present and different from the Target's current status. Sending the current status is not a lifecycle action. Only an ADMIN may change role. Last Admin cannot leave `ADMIN`. MANAGER may correct job title (and status, under the lifecycle matrix) of an EMPLOYEE. Employment id, Main Data, Personal Data, and password are unchanged. Dedicated Update Status remains for one-shot lifecycle actions and still refuses an unchanged status.
_Avoid_: update profile, two HTTP calls for one section save, treating status as a professional field, updating matrícula, treating an echoed status as already-in-status

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
The login-capable collaborator identified by the session, never by the request body, who executes a command on a Target. Who may act depends on the command: Remove is ADMIN-only; Update Main Employee Data, Update Personal Employee Data, and Job Title on Update Professional Employee Data allow ADMIN on any Target and MANAGER on EMPLOYEE only; Update Own Employee Data and Get Own Employee allow any login-capable role on self only. Changing Role is ADMIN-only.
_Avoid_: Target password, forged actorId, Actor must be ACTIVE-only

**Login-capable**:
Status from which a collaborator may authenticate and hold a full session: `ACTIVE` or `VACATION`. `INACTIVE` and `REMOVED` are not login-capable.
_Avoid_: isActive, enabled, not deactivated, ACTIVE-only session

**Target**:
The existing collaborator whose record a command addresses, distinct from the Actor. Role and status constrain what is allowed; they do not identify the Actor. Update Main Employee Data, Update Personal Employee Data, and Update Professional Employee Data allow `ACTIVE`, `VACATION`, and `INACTIVE`, and refuse Removed. Changing role or job title of an `INACTIVE` Target does not Reactivate them. Remove still requires `INACTIVE`. Update Own Employee Data and Get Own Employee do not address a Target: the only record is the Actor's, and a collaborator who is not login-capable is an Actor without a session, not a refused Target.
_Avoid_: victim, user, account, self as a Target on the Profile Card

**Removed**:
Terminal state after Anonymize. Absent from the collaborators list. The `employeeId` remains so other contexts can still point at that identity.
_Avoid_: deleted, hidden, archived, inactive

**Last Admin**:
The only `ADMIN` who is login-capable (`ACTIVE` or `VACATION`), or the only `ADMIN` who is not `REMOVED`. Cannot become `INACTIVE` while they are the last login-capable ADMIN; leftover `INACTIVE` ADMINs do not count as a second login. An ADMIN on `VACATION` still counts. May go on `VACATION` even as Last Admin. Cannot be Removed while they are the last non-`REMOVED` ADMIN. Cannot leave the `ADMIN` role while they are the last login-capable ADMIN or the last non-`REMOVED` ADMIN.
_Avoid_: last user, only login, must stay ACTIVE, Last Admin cannot take vacation, using ACTIVE-only count when leaving ADMIN
