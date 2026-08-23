# Lifecycle authority matrix (v1)

MANAGER operates only on `EMPLOYEE` (Deactivate / Reactivate). Peer `MANAGER` and any `ADMIN` are ADMIN-only. EMPLOYEE operates on nobody. Remove remains ADMIN-only, any target role except Last Admin.

This is stricter than today's `update-status` (any token, any target). The API must enforce the matrix; hiding buttons is not enough.
