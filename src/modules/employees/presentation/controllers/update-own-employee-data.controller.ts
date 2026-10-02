import {
  UpdateOwnEmployeeDataDto,
  UpdateOwnEmployeeDataDtoInput,
} from '@modules/employees/application/dtos/update-own-employee-data.dto';
import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';
import { UpdateOwnEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-own-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmptyOwnEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import {
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
  unauthorized,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { UpdateOwnEmployeeDataRequest } from '../http/update-own-employee-data.request';

const OWN_DATA_FIELDS = [
  'name',
  'phone',
  'username',
  'gender',
  'languages',
  'emergencyContact',
  'nif',
  'address',
] as const;

export class UpdateOwnEmployeeDataController extends BaseController<
  UpdateOwnEmployeeDataRequest,
  HttpErrorBody | HttpSuccessBody<GetEmployeesItemDto>
> {
  constructor(
    private readonly updateOwnEmployeeData: UpdateOwnEmployeeDataPort,
  ) {
    super();
  }

  async handle(
    request: UpdateOwnEmployeeDataRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetEmployeesItemDto>>
  > {
    try {
      const dto = this.normalizeDto(request);
      if (dto instanceof Error) {
        return badRequest(dto);
      }

      const readModel = await this.updateOwnEmployeeData.execute(dto);

      return ok(readModel);
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (
        error instanceof EmptyOwnEmployeeDataError ||
        error instanceof InvalidNameError ||
        error instanceof InvalidPhoneFormatError ||
        error instanceof InvalidNifError ||
        error instanceof InvalidEmployeeGenderError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }

  private normalizeDto(
    request: UpdateOwnEmployeeDataRequest,
  ): UpdateOwnEmployeeDataDto | MissingParamError | InvalidParamError {
    const presentOwnDataKeys = OWN_DATA_FIELDS.filter(
      (field) => field in request,
    );

    if (presentOwnDataKeys.length === 0) {
      return new MissingParamError('no own-employee-data fields');
    }

    if ('name' in request && this.isBlank(request.name)) {
      return new InvalidParamError('name');
    }

    if ('phone' in request && this.isBlank(request.phone)) {
      return new InvalidParamError('phone');
    }

    const dtoInput: UpdateOwnEmployeeDataDtoInput = {
      actorId: String(request.actorId ?? ''),
    };

    if ('name' in request) {
      dtoInput.name = request.name as string;
    }

    if ('phone' in request) {
      dtoInput.phone = request.phone as string;
    }

    if ('username' in request) {
      dtoInput.username = this.blankToNull(request.username);
    }

    if ('gender' in request) {
      dtoInput.gender = this.blankToNull(request.gender);
    }

    if ('languages' in request) {
      dtoInput.languages = this.blankToNull(request.languages);
    }

    if ('emergencyContact' in request) {
      dtoInput.emergencyContact = this.blankToNull(request.emergencyContact);
    }

    if ('nif' in request) {
      dtoInput.nif = this.normalizeNif(request.nif);
    }

    if ('address' in request) {
      dtoInput.address = this.blankToNull(request.address);
    }

    return new UpdateOwnEmployeeDataDto(dtoInput);
  }

  private isBlank(value: string | null | undefined): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    );
  }

  private blankToNull(value: string | null | undefined): string | null {
    if (this.isBlank(value)) {
      return null;
    }

    return value as string;
  }

  private normalizeNif(
    value: string | number | null | undefined,
  ): string | null {
    if (typeof value === 'number') {
      return this.blankToNull(String(value));
    }

    return this.blankToNull(value);
  }
}
