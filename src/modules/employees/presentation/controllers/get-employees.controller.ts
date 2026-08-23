import {
  GetEmployeesDto,
  GetEmployeesResultDto,
} from '@modules/employees/application/dtos/get-employees.dto';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { GetEmployeesRequest } from '../http/get-employees.request';

export class GetEmployeesController extends BaseController<
  GetEmployeesRequest,
  HttpErrorBody | HttpSuccessBody<GetEmployeesResultDto>
> {
  constructor(private readonly getEmployees: GetEmployeesPort) {
    super();
  }

  async handle(
    request: GetEmployeesRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetEmployeesResultDto>>
  > {
    try {
      const filters = this.normalizeFilters(request);
      if (filters instanceof Error) {
        return badRequest(filters);
      }

      const result = await this.getEmployees.execute(filters);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }

  private normalizeFilters(
    request: GetEmployeesRequest,
  ): GetEmployeesDto | InvalidParamError {
    let status: GetEmployeesDto['status'];
    if (request.status !== undefined && request.status !== '') {
      if (!EmployeeModel.isOperationalStatus(request.status)) {
        return new InvalidParamError('status');
      }
      status = request.status;
    }

    let role: GetEmployeesDto['role'];
    if (request.role !== undefined && request.role !== '') {
      if (!EmployeeModel.isRole(request.role)) {
        return new InvalidParamError('role');
      }
      role = request.role;
    }

    const search =
      typeof request.search === 'string' && request.search.trim() !== ''
        ? request.search.trim()
        : undefined;

    return {
      status,
      role,
      search,
      page: request.page,
      limit: request.limit,
    };
  }
}
