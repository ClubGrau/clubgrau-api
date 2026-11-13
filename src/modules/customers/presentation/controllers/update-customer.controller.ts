import {
  UpdateCustomerDto,
  UpdateCustomerResultDto,
} from '@modules/customers/application/dtos/update-customer.dto';
import { UpdateCustomerPort } from '@modules/customers/application/ports/inbound/update-customer.port';
import {
  CustomerAlreadyExistsError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
  EmptyCustomerUpdateDataError,
} from '@modules/customers/domain/errors/customer.errors';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  conflict,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { UpdateCustomerRequest } from '../http/update-customer.request';

const CUSTOMER_FIELDS = ['name', 'email', 'phone', 'nif'] as const;

export class UpdateCustomerController extends BaseController<
  UpdateCustomerRequest,
  HttpErrorBody | HttpSuccessBody<UpdateCustomerResultDto>
> {
  constructor(private readonly updateCustomer: UpdateCustomerPort) {
    super();
  }

  async handle(
    request: UpdateCustomerRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<UpdateCustomerResultDto>>
  > {
    try {
      const missingField = this.validationRequiredFields(request, ['id']);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const dto = this.normalizeDto(request);
      if (dto instanceof Error) {
        return badRequest(dto);
      }

      const result = await this.updateCustomer.execute(dto);

      return ok({ id: result.id });
    } catch (error) {
      if (
        error instanceof CustomerAlreadyExistsError ||
        error instanceof CustomerAlreadyRemovedError
      ) {
        return conflict(error);
      }

      if (
        error instanceof CustomerNotFoundError ||
        error instanceof EmptyCustomerUpdateDataError ||
        error instanceof InvalidNameError ||
        error instanceof InvalidEmailError ||
        error instanceof InvalidPhoneFormatError ||
        error instanceof InvalidNifError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }

  private normalizeDto(
    request: UpdateCustomerRequest,
  ): UpdateCustomerDto | MissingParamError | InvalidParamError {
    const presentKeys = CUSTOMER_FIELDS.filter((field) => field in request);

    if (presentKeys.length === 0) {
      return new MissingParamError('no customer fields');
    }

    if ('name' in request && this.isBlankOrNonString(request.name)) {
      return new InvalidParamError('name');
    }

    if ('email' in request && this.isBlankOrNonString(request.email)) {
      return new InvalidParamError('email');
    }

    const dto: UpdateCustomerDto = {
      id: String(request.id),
    };

    if ('name' in request) {
      dto.name = request.name as string;
    }

    if ('email' in request) {
      dto.email = request.email as string;
    }

    if ('phone' in request) {
      const phone = this.normalizePhone(request.phone);
      if (phone instanceof InvalidParamError) {
        return phone;
      }
      dto.phone = phone;
    }

    if ('nif' in request) {
      const nif = this.normalizeNif(request.nif);
      if (nif instanceof InvalidParamError) {
        return nif;
      }
      dto.nif = nif;
    }

    return dto;
  }

  private isBlankOrNonString(value: unknown): boolean {
    return typeof value !== 'string' || value.trim() === '';
  }

  private normalizePhone(value: unknown): string | null | InvalidParamError {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return new InvalidParamError('phone');
    }

    return value.trim() === '' ? null : value;
  }

  private normalizeNif(value: unknown): string | null | InvalidParamError {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return new InvalidParamError('nif');
      }
      return String(value);
    }

    if (typeof value !== 'string') {
      return new InvalidParamError('nif');
    }

    return value.trim() === '' ? null : value;
  }
}
