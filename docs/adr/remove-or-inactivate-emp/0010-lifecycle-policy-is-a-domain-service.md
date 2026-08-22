# Lifecycle authority lives in an EmployeeLifecyclePolicy domain service

The PRD matrix (who may Deactivate / Reactivate / Remove whom) and Last Admin rules are domain invariants, not HTTP. A dedicated `EmployeeLifecyclePolicy` (not `EmployeePoliciesService`, which owns create-time email occupancy) is called by both `UpdateEmployeeStatusUsecase` and `RemoveEmployeeUsecase`. Controllers and middleware do not encode the matrix. The policy depends on a domain port to count non-`REMOVED` ADMINs.
