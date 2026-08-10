import { CreateEmployeePort } from '@modules/employees/application/ports/inbound/create-employee.port';
import {
  CreateEmployeeDto,
  CreateEmployeeResultDto,
} from '@modules/employees/application/dtos/create-employee.dto';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  created,
  HttpErrorBody,
  HttpSuccessBody,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class CreateEmployeeController extends BaseController<
  CreateEmployeeDto,
  HttpErrorBody | HttpSuccessBody<CreateEmployeeResultDto>
> {
  constructor(private readonly createEmployee: CreateEmployeePort) {
    super();
  }

  async handle(
    request: CreateEmployeeDto,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<CreateEmployeeResultDto>>
  > {
    try {
      const requiredFields = [
        'name',
        'email',
        'password',
        'passwordConfirmation',
      ];

      const missingField = this.validationRequiredFields(
        request,
        requiredFields,
      );
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.createEmployee.execute({
        name: request.name,
        email: request.email,
        role: request.role,
        phone: request.phone,
        nif: request.nif,
        password: request.password,
        passwordConfirmation: request.passwordConfirmation,
      });

      return created({ id: result.id });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
