import {
  UpdateMainEmployeeDataDto,
  UpdateMainEmployeeDataDtoInput,
  UpdateMainEmployeeDataResultDto,
} from '@modules/employees/application/dtos/update-main-employee-data.dto';
import { UpdateMainEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-main-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyExistsError,
  EmployeeAlreadyRemovedError,
  EmployeeInactiveError,
  EmployeeMainDataForbiddenError,
  EmployeeNotFoundError,
  EmptyMainEmployeeDataError,
} from '@modules/employees/domain/errors/employee.errors';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
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
import { UpdateMainEmployeeDataRequest } from '../http/update-main-employee-data.request';

const MAIN_DATA_FIELDS = ['name', 'email', 'phone', 'username'] as const;

export class UpdateMainEmployeeDataController extends BaseController<
  UpdateMainEmployeeDataRequest,
  HttpErrorBody | HttpSuccessBody<UpdateMainEmployeeDataResultDto>
> {
  constructor(
    private readonly updateMainEmployeeData: UpdateMainEmployeeDataPort,
  ) {
    super();
  }

  async handle(
    request: UpdateMainEmployeeDataRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<UpdateMainEmployeeDataResultDto>
    >
  > {
    try {
      const UNABLE_TO_BE_UPDATED_FIELDS = ['status', 'password'];
      for (const field of UNABLE_TO_BE_UPDATED_FIELDS) {
        if (field in request) {
          return badRequest(new InvalidParamError(field));
        }
      }

      const dto = this.normalizeDto(request);
      if (dto instanceof Error) {
        return badRequest(dto);
      }

      const result = await this.updateMainEmployeeData.execute(dto);

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (error instanceof EmployeeMainDataForbiddenError) {
        return forbidden(error);
      }

      if (
        error instanceof EmployeeAlreadyRemovedError ||
        error instanceof EmployeeAlreadyExistsError ||
        error instanceof EmployeeInactiveError
      ) {
        return conflict(error);
      }

      if (
        error instanceof EmployeeNotFoundError ||
        error instanceof EmptyMainEmployeeDataError ||
        error instanceof InvalidEmailError ||
        error instanceof InvalidNameError ||
        error instanceof InvalidPhoneFormatError ||
        error instanceof InvalidParamError ||
        error instanceof MissingParamError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }

  private normalizeDto(
    request: UpdateMainEmployeeDataRequest,
  ): UpdateMainEmployeeDataDto | InvalidParamError | MissingParamError {
    const presentMainDataKeys = MAIN_DATA_FIELDS.filter(
      (field) => field in request,
    );

    if (presentMainDataKeys.length === 0) {
      return new MissingParamError('no main-data fields');
    }

    for (const field of MAIN_DATA_FIELDS) {
      if (!(field in request)) {
        continue;
      }

      if (this.isBlank(request[field])) {
        return new InvalidParamError(field);
      }
    }

    const dtoInput = {
      actorId: request.actorId,
      id: request.id,
      name: request.name,
      email: request.email,
      phone: request.phone,
      username: request.username,
    };

    return new UpdateMainEmployeeDataDto(
      dtoInput as UpdateMainEmployeeDataDtoInput,
    );
  }

  private isBlank(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    );
  }
}
