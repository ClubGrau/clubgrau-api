import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export interface FindEmployeeByIdPort {
  findById(id: string): Promise<EmployeeModel.toCreate | null>;
}
