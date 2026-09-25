import {
  UpdatePersonalEmployeeDataDto,
  UpdatePersonalEmployeeDataDtoInput,
  UpdatePersonalEmployeeDataResultDto,
} from '@modules/employees/application/dtos/update-personal-employee-data.dto';
import { UpdatePersonalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-personal-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeNotFoundError,
  EmployeePersonalDataForbiddenError,
  EmptyPersonalEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import {
  InvalidNifError,
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
import { UpdatePersonalEmployeeDataRequest } from '../http/update-personal-employee-data.request';

const PERSONAL_DATA_FIELDS = [
  'gender',
  'languages',
  'emergencyContact',
  'nif',
  'address',
] as const;

type PersonalDataField = (typeof PERSONAL_DATA_FIELDS)[number];

export class UpdatePersonalEmployeeDataController extends BaseController<
  UpdatePersonalEmployeeDataRequest,
  HttpErrorBody | HttpSuccessBody<UpdatePersonalEmployeeDataResultDto>
> {
  constructor(
    private readonly updatePersonalEmployeeData: UpdatePersonalEmployeeDataPort,
  ) {
    super();
  }

  async handle(
    request: UpdatePersonalEmployeeDataRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<UpdatePersonalEmployeeDataResultDto>
    >
  > {
    try {
      const dto = this.normalizeDto(request);
      if (dto instanceof MissingParamError) {
        return badRequest(dto);
      }

      const result = await this.updatePersonalEmployeeData.execute(dto);

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (error instanceof EmployeePersonalDataForbiddenError) {
        return forbidden(error);
      }

      if (error instanceof EmployeeAlreadyRemovedError) {
        return conflict(error);
      }

      if (
        error instanceof EmployeeNotFoundError ||
        error instanceof EmptyPersonalEmployeeDataError ||
        error instanceof InvalidPhoneFormatError ||
        error instanceof InvalidNifError
      ) {
        return badRequest(error);
      }

      if (error instanceof InvalidEmployeeGenderError) {
        return badRequest(new InvalidParamError('gender'));
      }

      return serverError(error as Error);
    }
  }

  private normalizeDto(
    request: UpdatePersonalEmployeeDataRequest,
  ): UpdatePersonalEmployeeDataDto | MissingParamError {
    const presentPersonalDataKeys = PERSONAL_DATA_FIELDS.filter(
      (field) => field in request,
    );

    if (presentPersonalDataKeys.length === 0) {
      return new MissingParamError('no personal-data fields');
    }

    const dtoInput: UpdatePersonalEmployeeDataDtoInput = {
      actorId: String(request.actorId ?? ''),
      id: String(request.id ?? ''),
    };

    for (const field of presentPersonalDataKeys) {
      dtoInput[field] = this.normalizePersonalField(field, request);
    }

    return new UpdatePersonalEmployeeDataDto(dtoInput);
  }

  private normalizePersonalField(
    field: PersonalDataField,
    request: UpdatePersonalEmployeeDataRequest,
  ): string | null {
    switch (field) {
      case 'gender':
        return request.gender === null ? null : request.gender!;
      case 'languages':
        return this.blankStringToNull(request?.languages ?? null);
      case 'address':
        return this.blankStringToNull(request?.address ?? null);
      case 'emergencyContact':
        return request.emergencyContact === null
          ? null
          : request.emergencyContact!;
      case 'nif':
        return this.normalizeNif(request?.nif ?? null);
    }
  }

  private blankStringToNull(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }

    return value as string;
  }

  private normalizeNif(value: string | number | null): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return value as string;
  }
}
