import { UpdateEmployeeStatusResultDto } from '@modules/employees/application/dtos/update-employee-status.dto';
import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { UpdateEmployeeStatusRequest } from '../http/update-employee-status.request';
import {
  EmployeeAlreadyInactiveError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';

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

      if (!EmployeeModel.isStatus(request.status)) {
        return badRequest(new InvalidParamError('status'));
      }

      const { id, status } = request;

      const result = await this.updateEmployeeStatus.execute({
        id: String(id),
        status,
      });

      return ok({ id: result.id, status: result.status });
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) {
        return badRequest(error);
      }

      if (error instanceof EmployeeAlreadyInactiveError) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
