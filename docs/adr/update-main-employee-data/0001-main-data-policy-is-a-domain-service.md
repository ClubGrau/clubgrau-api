# Main Data authority lives in an EmployeeMainDataPolicy domain service

Who may Update Main Employee Data is a domain invariant, not HTTP and not a lifecycle intent. A dedicated `EmployeeMainDataPolicy` owns the matrix (EMPLOYEE nobody; MANAGER only EMPLOYEE, including self refused; ADMIN any Target including self), Actor login-capable, and Target not Removed. It is not an intent on `EmployeeLifecyclePolicy` — that service keeps Deactivate / Reactivate / Vacation / Remove and Last Admin. Email occupancy stays on `EmployeePoliciesService`.
