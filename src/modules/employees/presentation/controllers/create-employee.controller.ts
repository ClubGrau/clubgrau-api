import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

interface HttpResponse<T> {
  statusCode: number;
  body: T;
}

type HttpErrorBody = { error: string };
type HttpSuccessBody<T> = { data: T };

export class CreateEmployeeController {
  handle(
    request: EmployeeModel.CreateEmployeeDto,
  ): HttpResponse<
    HttpErrorBody | HttpSuccessBody<EmployeeModel.CreateEmployeeResultDto>
  > {
    const requiredFields = [
      'name',
      'email',
      'password',
      'passwordConfirmation',
    ];

    for (const field of requiredFields) {
      const value = request[field as keyof EmployeeModel.CreateEmployeeDto];
      if (!value) {
        return {
          statusCode: 400,
          body: {
            error: `Missing param ${field}`,
          },
        };
      }
    }

    // TODO: call CreateEmployeeUsecase and return { data: result }
    return {
      statusCode: 200,
      body: {
        data: { id: '' },
      },
    };
  }
}
