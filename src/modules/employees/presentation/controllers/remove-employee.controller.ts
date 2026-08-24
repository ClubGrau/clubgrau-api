import { RemoveEmployeeResultDto } from '@modules/employees/application/dtos/remove-employee.dto';
import { RemoveEmployeePort } from '@modules/employees/application/ports/inbound/remove-employee.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeNotInactiveError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  conflict,
  forbidden,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
  unauthorized,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { RemoveEmployeeRequest } from '../http/remove-employee.request';

export class RemoveEmployeeController extends BaseController<
  RemoveEmployeeRequest,
  HttpErrorBody | HttpSuccessBody<RemoveEmployeeResultDto>
> {
  constructor(private readonly removeEmployeeUsecase: RemoveEmployeePort) {
    super();
  }

  async handle(
    request: RemoveEmployeeRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<RemoveEmployeeResultDto>>
  > {
    try {
      const missingField = this.validationRequiredFields(request, [
        'id',
        'password',
      ]);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.removeEmployeeUsecase.execute({
        actorId: String(request.actorId ?? ''),
        targetId: String(request.id),
        actorPassword: String(request.password),
      });

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (error instanceof EmployeeLifecycleForbiddenError) {
        return forbidden(error);
      }

      if (
        error instanceof LastAdminProtectedError ||
        error instanceof EmployeeNotInactiveError ||
        error instanceof EmployeeAlreadyRemovedError
      ) {
        return conflict(error);
      }

      if (error instanceof EmployeeNotFoundError) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
