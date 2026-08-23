import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export interface UpdateEmployeeStatusParams {
  id: string;
  status: EmployeeModel.Status;
  deactivateAt: Date | null;
}

export interface UpdateEmployeeStatusRepositoryPort {
  updateStatus(params: UpdateEmployeeStatusParams): Promise<void>;
}
