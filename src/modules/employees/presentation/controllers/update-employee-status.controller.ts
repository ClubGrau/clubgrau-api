import { UpdateEmployeeStatusResultDto } from '@modules/employees/application/dtos/update-employee-status.dto';
import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
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
import { UpdateEmployeeStatusRequest } from '../http/update-employee-status.request';

export class UpdateEmployeeStatusController extends BaseController<
  UpdateEmployeeStatusRequest,
  HttpErrorBody | HttpSuccessBody<UpdateEmployeeStatusResultDto>
> {
  constructor(private readonly updateEmployeeStatus: UpdateEmployeeStatusPort) {
    super();
  }

  async handle(
    request: UpdateEmployeeStatusRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<UpdateEmployeeStatusResultDto>>
  > {
    try {
      const missingField = this.validationRequiredFields(request, [
        'id',
        'status',
      ]);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      if (!EmployeeModel.isOperationalStatus(request.status)) {
        return badRequest(new InvalidParamError('status'));
      }

      const result = await this.updateEmployeeStatus.execute({
        actorId: String(request.actorId ?? ''),
        id: String(request.id),
        status: request.status,
      });

      return ok({ id: result.id, status: result.status });
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (error instanceof EmployeeLifecycleForbiddenError) {
        return forbidden(error);
      }

      if (
        error instanceof LastAdminProtectedError ||
        error instanceof EmployeeAlreadyRemovedError
      ) {
        return conflict(error);
      }

      if (
        error instanceof EmployeeNotFoundError ||
        error instanceof EmployeeAlreadyActiveError ||
        error instanceof EmployeeAlreadyInactiveError ||
        error instanceof EmployeeAlreadyOnVacationError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
