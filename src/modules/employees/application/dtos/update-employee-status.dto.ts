import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

/** Input do caso de uso UpdateEmployeeStatus (entrada da application). */
export interface UpdateEmployeeStatusDto {
  /** Stampado pelo adaptRoute a partir do JWT; nunca do body do cliente. */
  actorId: string;
  id: string;
  status: EmployeeModel.OperationalStatus;
}

/** Output do caso de uso UpdateEmployeeStatus (saída da application). */
export interface UpdateEmployeeStatusResultDto {
  id: string;
  status: EmployeeModel.Status;
}
