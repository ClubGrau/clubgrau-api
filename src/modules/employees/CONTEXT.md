# Employees

Identity and lifecycle of a collaborator on the Club Grau platform. This context owns the employee record; other contexts reference a collaborator by id only.

## Language

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
The authenticated ADMIN who executes Remove. Must be login-capable (`ACTIVE` or `VACATION`). The modal asks only for their password (not the Target’s, not `passwordConfirmation`, not the Target’s name typed out). The `id` in the request is the Target.
_Avoid_: Target password, passwordConfirmation, any token, MANAGER acting on ADMIN, Actor must be ACTIVE

**Login-capable**:
Status from which a collaborator may authenticate and hold a full session: `ACTIVE` or `VACATION`. `INACTIVE` and `REMOVED` are not login-capable.
_Avoid_: isActive, enabled, not deactivated, ACTIVE-only session

**Target**:
The `INACTIVE` collaborator who is a candidate for Reactivate or Remove. May be `ADMIN`, `MANAGER`, or `EMPLOYEE` — the Target’s role does not by itself block Remove.
_Avoid_: victim, user, account

**Removed**:
Terminal state after Anonymize. Absent from the collaborators list. The `employeeId` remains so other contexts can still point at that identity.
_Avoid_: deleted, hidden, archived, inactive

**Last Admin**:
The only `ADMIN` who is login-capable (`ACTIVE` or `VACATION`), or — for Remove — the only `ADMIN` who is not `REMOVED`. Cannot become `INACTIVE` while they are the last login-capable ADMIN; leftover `INACTIVE` ADMINs do not count as a second login. An ADMIN on `VACATION` still counts. May go on `VACATION` even as Last Admin. Cannot be Removed while they are the last non-`REMOVED` ADMIN.
_Avoid_: last user, only login, must stay ACTIVE, Last Admin cannot take vacation
