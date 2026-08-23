import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

/** Input do caso de uso UpdateEmployeeStatus (entrada da application). */
export interface UpdateEmployeeStatusDto {
  id: string;
  status: EmployeeModel.Status;
}

/** Output do caso de uso UpdateEmployeeStatus (saída da application). */
export interface UpdateEmployeeStatusResultDto {
  id: string;
  status: EmployeeModel.Status;
}
