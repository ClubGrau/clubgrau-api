import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import {
  CreateCustomerDto,
  CreateCustomerResultDto,
} from '@modules/customers/application/dtos/create-customer.dto';
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

export class CreateCustomerController extends BaseController<
  CreateCustomerDto,
  HttpErrorBody | HttpSuccessBody<CreateCustomerResultDto>
> {
  constructor(private readonly createCustomer: CreateCustomerPort) {
    super();
  }

  async handle(
    request: CreateCustomerDto,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<CreateCustomerResultDto>>
  > {
    try {
      const requiredFields = ['name', 'email'];

      const missingField = this.validationRequiredFields(
        request,
        requiredFields,
      );
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.createCustomer.execute({
        name: request.name,
        email: request.email,
        phone: request.phone,
        nif: request.nif,
      });

      return created({ id: result.id });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
