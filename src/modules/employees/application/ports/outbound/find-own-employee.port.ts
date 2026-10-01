import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';

export interface FindOwnEmployeePort {
  findOwnEmployee(id: string): Promise<GetEmployeesItemDto | null>;
}
