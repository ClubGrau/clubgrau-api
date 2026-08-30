import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

/** Input do caso de uso CreateEmployee (entrada da application). */
export interface CreateEmployeeDto {
  name: string;
  email: string;
  role: EmployeeModel.Role;
  phone?: string | null;
  nif?: number | null;
  password: string;
  passwordConfirmation: string;
  username?: string | null;
  gender?: string | null;
  address?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  employmentId?: string | null;
  jobTitle?: string | null;
}

/** Output do caso de uso CreateEmployee (saída da application). */
export interface CreateEmployeeResultDto {
  id: string;
}
