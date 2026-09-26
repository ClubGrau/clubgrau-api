import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export interface UpdateProfessionalEmployeeDataParams {
  id: string;
  jobTitle?: string | null;
  role?: EmployeeModel.Role;
  status?: EmployeeModel.Status;
  deactivateAt?: Date | null;
}

export interface UpdateProfessionalEmployeeDataRepositoryPort {
  updateProfessionalData(
    params: UpdateProfessionalEmployeeDataParams,
  ): Promise<void>;
}
