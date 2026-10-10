import { EndIndicationOriginResultDto } from '@modules/indications/application/dtos/end-indication-origin.dto';
import { EndIndicationOriginPort } from '@modules/indications/application/ports/inbound/end-indication-origin.port';
import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { EndIndicationOriginRequest } from '../http/end-indication-origin.request';

export class EndIndicationOriginController extends BaseController<
  EndIndicationOriginRequest,
  HttpErrorBody | HttpSuccessBody<EndIndicationOriginResultDto>
> {
  constructor(private readonly endIndicationOrigin: EndIndicationOriginPort) {
    super();
  }

  async handle(
    request: EndIndicationOriginRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<EndIndicationOriginResultDto>>
  > {
    try {
      const requiredFields = ['id'];

      const missingField = this.validationRequiredFields(
        request,
        requiredFields,
      );
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.endIndicationOrigin.execute({
        id: request.id,
      });

      return ok({ id: result.id });
    } catch (error) {
      if (error instanceof IndicationOriginNotFoundError) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
