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
import { CreateEmployeeRequest } from '../http/create-employee.request';

export class CreateEmployeeController extends BaseController<
  CreateEmployeeRequest,
  HttpErrorBody | HttpSuccessBody<CreateEmployeeResultDto>
> {
  constructor(private readonly createEmployee: CreateEmployeePort) {
    super();
  }

  async handle(
    request: CreateEmployeeRequest,
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
        name: String(request.name),
        email: String(request.email),
        role: request.role as CreateEmployeeDto['role'],
        phone: request.phone,
        nif: request.nif ? Number(request.nif) : null,
        password: String(request.password),
        passwordConfirmation: String(request.passwordConfirmation),
        username: request.username ?? null,
        gender: request.gender ?? null,
        address: request.address ?? null,
        languages: request.languages ?? null,
        emergencyContact: request.emergencyContact ?? null,
        employmentId: request.employmentId ?? null,
        jobTitle: request.jobTitle ?? null,
      });

      return created({ id: result.id });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
