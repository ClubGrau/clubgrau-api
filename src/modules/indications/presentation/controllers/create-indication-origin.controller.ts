import { CreateIndicationOriginResultDto } from '@modules/indications/application/dtos/create-indication-origin.dto';
import { CreateIndicationOriginPort } from '@modules/indications/application/ports/inbound/create-indication-origin.port';
import {
  IndicationCategoryDoesNotHoldOriginsError,
  IndicationCategoryUnknownError,
  IndicationOriginNameTakenError,
} from '@modules/indications/domain/errors/indication.errors';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
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
import { CreateIndicationOriginRequest } from '../http/create-indication-origin.request';

export class CreateIndicationOriginController extends BaseController<
  CreateIndicationOriginRequest,
  HttpErrorBody | HttpSuccessBody<CreateIndicationOriginResultDto>
> {
  constructor(
    private readonly createIndicationOrigin: CreateIndicationOriginPort,
  ) {
    super();
  }

  async handle(
    request: CreateIndicationOriginRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<CreateIndicationOriginResultDto>
    >
  > {
    try {
      const requiredFields = ['categoryId', 'name'];

      const missingField = this.validationRequiredFields(
        request,
        requiredFields,
      );
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.createIndicationOrigin.execute({
        categoryId: request.categoryId,
        name: request.name,
      });

      return created({ id: result.id });
    } catch (error) {
      if (
        error instanceof IndicationCategoryUnknownError ||
        error instanceof IndicationCategoryDoesNotHoldOriginsError ||
        error instanceof InvalidNameError
      ) {
        return badRequest(error);
      }

      if (error instanceof IndicationOriginNameTakenError) {
        return conflict(error);
      }

      return serverError(error as Error);
    }
  }
}
