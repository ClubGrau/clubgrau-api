import { RemoveCustomerResultDto } from '@modules/customers/application/dtos/remove-customer.dto';
import { RemoveCustomerPort } from '@modules/customers/application/ports/inbound/remove-customer.port';
import {
  CustomerActorAuthenticationFailedError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  conflict,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
  unauthorized,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { RemoveCustomerRequest } from '../http/remove-customer.request';

export class RemoveCustomerController extends BaseController<
  RemoveCustomerRequest,
  HttpErrorBody | HttpSuccessBody<RemoveCustomerResultDto>
> {
  constructor(private readonly removeCustomerUsecase: RemoveCustomerPort) {
    super();
  }

  async handle(
    request: RemoveCustomerRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<RemoveCustomerResultDto>>
  > {
    try {
      const missingField = this.validationRequiredFields(request, [
        'id',
        'password',
      ]);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.removeCustomerUsecase.execute({
        actorId: String(request.actorId ?? ''),
        customerId: String(request.id),
        actorPassword: String(request.password),
      });

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof CustomerActorAuthenticationFailedError) {
        return unauthorized(error);
      }

      if (error instanceof CustomerAlreadyRemovedError) {
        return conflict(error);
      }

      if (error instanceof CustomerNotFoundError) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
