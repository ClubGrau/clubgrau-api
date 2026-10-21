import {
  CreateCustomerIndicationDto,
  CreateCustomerResultDto,
} from '@modules/customers/application/dtos/create-customer.dto';
import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import {
  CustomerAlreadyExistsError,
  CustomerIndicationInvalidError,
  CustomerIndicationOriginCategoryMismatchError,
  CustomerIndicationOriginEndedError,
  CustomerIndicationOriginNotFoundError,
  CustomerReferrerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { InvalidEmailError } from '@shared/domain/value-object/email/email.vo';
import { InvalidUniqueEntityIdError } from '@shared/domain/value-object/id/unique-entity-id.vo';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
import { InvalidNifError } from '@shared/domain/value-object/nif/nif.vo';
import { InvalidPhoneFormatError } from '@shared/domain/value-object/phone/phone.vo';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  conflict,
  created,
  HttpErrorBody,
  HttpSuccessBody,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { CreateCustomerRequest } from '../http/create-customer.request';

type IndicationRequest = NonNullable<CreateCustomerRequest['indication']>;

export class CreateCustomerController extends BaseController<
  CreateCustomerRequest,
  HttpErrorBody | HttpSuccessBody<CreateCustomerResultDto>
> {
  constructor(private readonly createCustomer: CreateCustomerPort) {
    super();
  }

  async handle(
    request: CreateCustomerRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<CreateCustomerResultDto>>
  > {
    try {
      const missingField = this.validationRequiredFields(request, [
        'name',
        'email',
      ]);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const indication = this.resolveIndication(request.indication);
      if (
        indication instanceof MissingParamError ||
        indication instanceof CustomerIndicationInvalidError
      ) {
        return badRequest(indication);
      }

      const result = await this.createCustomer.execute({
        name: request.name,
        email: request.email,
        phone: request.phone,
        nif: request.nif,
        indication,
      });

      return created({ id: result.id });
    } catch (error) {
      if (
        error instanceof InvalidNameError ||
        error instanceof InvalidEmailError ||
        error instanceof InvalidPhoneFormatError ||
        error instanceof InvalidNifError ||
        error instanceof InvalidUniqueEntityIdError ||
        error instanceof CustomerIndicationInvalidError ||
        error instanceof CustomerIndicationOriginNotFoundError ||
        error instanceof CustomerIndicationOriginCategoryMismatchError ||
        error instanceof CustomerIndicationOriginEndedError ||
        error instanceof CustomerReferrerNotFoundError
      ) {
        return badRequest(error);
      }

      if (error instanceof CustomerAlreadyExistsError) {
        return conflict(error);
      }

      return serverError(error as Error);
    }
  }

  private resolveIndication(
    rawIndication: CreateCustomerRequest['indication'],
  ):
    | CreateCustomerIndicationDto
    | null
    | MissingParamError
    | CustomerIndicationInvalidError {
    const indication: unknown = rawIndication;

    if (indication === null || indication === undefined) {
      return null;
    }

    if (typeof indication !== 'object' || Array.isArray(indication)) {
      return new CustomerIndicationInvalidError();
    }

    const missingCategory = this.validationRequiredFields(indication, [
      'categoryId',
    ]);
    if (missingCategory) {
      return new MissingParamError('indication.categoryId');
    }

    const indicationRequest = indication as IndicationRequest;

    return {
      categoryId: indicationRequest.categoryId,
      originId: indicationRequest.originId,
      referrerCustomerId: indicationRequest.referrerCustomerId,
    };
  }
}
