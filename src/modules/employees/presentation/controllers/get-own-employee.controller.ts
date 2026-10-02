import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';
import { GetOwnEmployeePort } from '@modules/employees/application/ports/inbound/get-own-employee.port';
import { ActorAuthenticationFailedError } from '@modules/employees/domain/errors/employee.errors';
import {
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
  unauthorized,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { GetOwnEmployeeRequest } from '../http/get-own-employee.request';

export class GetOwnEmployeeController extends BaseController<
  GetOwnEmployeeRequest,
  HttpErrorBody | HttpSuccessBody<GetEmployeesItemDto>
> {
  constructor(private readonly getOwnEmployee: GetOwnEmployeePort) {
    super();
  }

  async handle(
    request: GetOwnEmployeeRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetEmployeesItemDto>>
  > {
    try {
      const readModel = await this.getOwnEmployee.execute({
        actorId: String(request.actorId ?? ''),
      });

      return ok(readModel);
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      return serverError(error as Error);
    }
  }
}
