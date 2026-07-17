import { CreateEmployeeUsecase } from '@modules/employees/application/usecases/create-employee.usecase';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class CreateEmployeeController extends BaseController<
  EmployeeModel.CreateEmployeeDto,
  HttpErrorBody | HttpSuccessBody<EmployeeModel.CreateEmployeeResultDto>
> {
  constructor(private readonly createEmployeeUsecase: CreateEmployeeUsecase) {
    super();
  }

  async handle(
    request: EmployeeModel.CreateEmployeeDto,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<EmployeeModel.CreateEmployeeResultDto>
    >
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

      const result = await this.createEmployeeUsecase.execute({
        name: request.name,
        email: request.email,
        role: request.role,
        password: request.password,
        passwordConfirmation: request.passwordConfirmation,
      });

      return {
        statusCode: 201,
        body: {
          data: { id: result.id },
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          statusCode: 500,
          body: {
            error: error.message,
          },
        };
      }
      throw error;
    }
  }
}
