import {
  normalizePagination,
  toPaginatedResult,
} from '@shared/application/pagination/pagination.dto';
import {
  GetEmployeesDto,
  GetEmployeesResultDto,
} from '../dtos/get-employees.dto';
import { GetEmployeesPort } from '../ports/inbound/get-employees.port';
import { FindEmployeesPort } from '../ports/outbound/find-employees.port';

export class GetEmployeesQuery implements GetEmployeesPort {
  constructor(private readonly findEmployees: FindEmployeesPort) {}

  async execute(filters: GetEmployeesDto): Promise<GetEmployeesResultDto> {
    const pagination = normalizePagination(filters);
    const search = filters.search?.trim() || undefined;

    const { items, total } = await this.findEmployees.findAll({
      isActive: this.isActiveValidation(filters),
      role: filters.role,
      search,
      skip: pagination.skip,
      limit: pagination.limit,
    });

    const {
      page,
      limit,
      total: totalItems,
      totalPages,
    } = toPaginatedResult(items, total, pagination);

    return {
      employees: items,
      page,
      limit,
      total: totalItems,
      totalPages,
    };
  }

  private isActiveValidation({ status }: GetEmployeesDto): boolean | undefined {
    const statusMap: Record<string, boolean> = {
      active: true,
      inactive: false,
    };

    return statusMap[status as keyof typeof statusMap] ?? undefined;
  }
}
