import { EmployeeModel } from '../models/employee.model';

export interface FindEmployeeByEmailPort {
  findByEmail(email: string): Promise<EmployeeModel.toCreate | null>;
}
