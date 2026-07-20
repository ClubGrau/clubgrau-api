import {
  GetEmployeesDto,
  GetEmployeesResultDto,
} from '@modules/employees/application/dtos/get-employees.dto';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import {
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class GetEmployeesController extends BaseController<
  GetEmployeesDto,
  HttpErrorBody | HttpSuccessBody<GetEmployeesResultDto>
> {
  constructor(private readonly getEmployees: GetEmployeesPort) {
    super();
  }

  async handle(
    request: GetEmployeesDto,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetEmployeesResultDto>>
  > {
    try {
      const employees = await this.getEmployees.execute({
        isActive: request.isActive,
        role: request.role,
      });

      return ok({ employees });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
