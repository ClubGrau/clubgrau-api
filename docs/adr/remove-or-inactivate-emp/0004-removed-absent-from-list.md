# REMOVED collaborators are absent from the list

After Remove, `GET /api/employees` never returns `REMOVED`. Showing sentinels on the collaborators screen would look like real people and confuse Reactivate vs Create. No `status=REMOVED` filter in this version. Any history bound to that `employeeId` is not surfaced on this list.
