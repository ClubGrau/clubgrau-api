# Last non-REMOVED ADMIN cannot be Removed

An ADMIN may be a Remove Target (role does not protect them). The exception is the last collaborator with role `ADMIN` whose status is not `REMOVED`. Removing that identity would leave the platform with no recoverable ADMIN.

Interview note: this ADR first treated an `INACTIVE` Last Admin as still recoverable via Reactivate. After the authority matrix (0007), a MANAGER cannot Reactivate an ADMIN, so 0008 forbids Deactivate of Last Admin as well. 0003 still holds for Remove.
