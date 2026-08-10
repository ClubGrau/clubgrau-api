import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { PaginationInputDto } from '@shared/application/pagination/pagination.dto';

/** Input da query GetEmployees (filtros + paginação offset). */
export interface GetEmployeesDto extends PaginationInputDto {
  isActive?: boolean;
  role?: EmployeeModel.Role;
}

/**
 * Read model de um employee na listagem.
 * Não inclui password — distinto de EmployeeModel.toCreate.
 */
export interface GetEmployeesItemDto {
  id: string;
  name: string;
  email: string;
  role: EmployeeModel.Role;
  phone: string | null;
  nif: string | null;
  isActive: boolean;
  createdAt: Date;
  deactivateAt: Date | null;
}

/** Params do outbound port de leitura (já com skip/limit normalizados). */
export interface FindEmployeesParams {
  isActive?: boolean;
  role?: EmployeeModel.Role;
  skip: number;
  limit: number;
}

/** Resultado bruto do repositório antes do envelope HTTP. */
export interface FindEmployeesResult {
  items: GetEmployeesItemDto[];
  total: number;
}

/** Output da query GetEmployees (lista nomeada + meta de paginação). */
export interface GetEmployeesResultDto {
  employees: GetEmployeesItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
