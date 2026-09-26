# Status may travel on Update Professional Employee Data

The professional section of Edit Collaborator shows Status on the same **Salvar seção** as Job Title and Role. Main and Personal PATCHes reject or ignore `status` and leave lifecycle on `POST /api/employee/update-status`.

We decided the professional PATCH **may include `status`**. When the value differs from the Target, the use case applies the existing `EmployeeLifecyclePolicy` and entity transitions in the same write. When it matches, it is a no-op (the form echoes Status). The dedicated Update Status endpoint stays for list shortcuts and still refuses an unchanged status.

Rejected: two HTTP calls from one save (partial apply), and a separate orchestrator route. One section, one command; lifecycle rules are reused, not copied.
