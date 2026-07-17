import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export interface CreateEmployeeRepositoryPort {
  create(
    employee: EmployeeModel.toCreate,
  ): Promise<EmployeeModel.CreateEmployeeResultDto>;
}
