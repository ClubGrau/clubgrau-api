import {
  UpdateProfessionalEmployeeDataDto,
  UpdateProfessionalEmployeeDataDtoInput,
  UpdateProfessionalEmployeeDataResultDto,
} from '@modules/employees/application/dtos/update-professional-employee-data.dto';
import { UpdateProfessionalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-professional-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeProfessionalDataForbiddenError,
  EmptyProfessionalEmployeeDataError,
  InvalidEmployeeRoleError,
  InvalidEmployeeStatusError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
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
import { UpdateProfessionalEmployeeDataRequest } from '../http/update-professional-employee-data.request';

const PROFESSIONAL_DATA_FIELDS = ['jobTitle', 'role', 'status'] as const;

export class UpdateProfessionalEmployeeDataController extends BaseController<
  UpdateProfessionalEmployeeDataRequest,
  HttpErrorBody | HttpSuccessBody<UpdateProfessionalEmployeeDataResultDto>
> {
  constructor(
    private readonly updateProfessionalEmployeeData: UpdateProfessionalEmployeeDataPort,
  ) {
    super();
  }

  async handle(
    request: UpdateProfessionalEmployeeDataRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<UpdateProfessionalEmployeeDataResultDto>
    >
  > {
    try {
      if ('password' in request) {
        return badRequest(new InvalidParamError('password'));
      }

      const dto = this.normalizeDto(request);
      const missingParamError = dto instanceof MissingParamError;
      const invalidParamError = dto instanceof InvalidParamError;
      if (missingParamError || invalidParamError) {
        return badRequest(dto);
      }

      const result = await this.updateProfessionalEmployeeData.execute(dto);

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof ActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (
        error instanceof EmployeeProfessionalDataForbiddenError ||
        error instanceof EmployeeLifecycleForbiddenError
      ) {
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
        error instanceof EmptyProfessionalEmployeeDataError ||
        error instanceof InvalidEmployeeRoleError ||
        error instanceof InvalidEmployeeStatusError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }

  private normalizeDto(
    request: UpdateProfessionalEmployeeDataRequest,
  ): UpdateProfessionalEmployeeDataDto | MissingParamError | InvalidParamError {
    const presentCommandKeys = PROFESSIONAL_DATA_FIELDS.filter(
      (field) => field in request,
    );

    if (presentCommandKeys.length === 0) {
      return new MissingParamError('no professional-data fields');
    }

    if ('role' in request && this.isBlank(request.role)) {
      return new InvalidParamError('role');
    }

    if ('status' in request && this.isBlank(request.status)) {
      return new InvalidParamError('status');
    }

    const dtoInput: UpdateProfessionalEmployeeDataDtoInput = {
      actorId: String(request.actorId ?? ''),
      id: String(request.id ?? ''),
    };

    if ('jobTitle' in request) {
      dtoInput.jobTitle = this.isBlank(request.jobTitle)
        ? null
        : request.jobTitle!;
    }

    if ('role' in request) {
      dtoInput.role = request.role!;
    }

    if ('status' in request) {
      dtoInput.status = request.status!;
    }

    return new UpdateProfessionalEmployeeDataDto(dtoInput);
  }

  private isBlank(value: string | null | undefined): boolean {
    return value == null || value.trim() === '';
  }
}
