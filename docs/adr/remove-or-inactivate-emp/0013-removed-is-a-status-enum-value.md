# REMOVED is a Status enum value, not a side flag

`EmployeeModel.Status` includes `REMOVED`. Reconstitution uses the full enum. HTTP update-status and list filters accept only operational statuses (`ACTIVE` | `INACTIVE` | `VACATION`). `GET /api/employees?status=REMOVED` is `400`. Persistence list queries always exclude `REMOVED` so sentinels never leak onto the collaborators screen.
