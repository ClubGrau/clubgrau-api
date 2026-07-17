import { Employee } from '@modules/employees/domain/entities/Employee';

export interface FindEmployeeByEmailPort {
  findByEmail(email: string): Promise<Employee | null>;
}
