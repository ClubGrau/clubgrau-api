import { ReopenIndicationOriginResultDto } from '@modules/indications/application/dtos/reopen-indication-origin.dto';
import { ReopenIndicationOriginPort } from '@modules/indications/application/ports/inbound/reopen-indication-origin.port';
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
import { ReopenIndicationOriginRequest } from '../http/reopen-indication-origin.request';

export class ReopenIndicationOriginController extends BaseController<
  ReopenIndicationOriginRequest,
  HttpErrorBody | HttpSuccessBody<ReopenIndicationOriginResultDto>
> {
  constructor(
    private readonly reopenIndicationOrigin: ReopenIndicationOriginPort,
  ) {
    super();
  }

  async handle(
    request: ReopenIndicationOriginRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<ReopenIndicationOriginResultDto>
    >
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

      const result = await this.reopenIndicationOrigin.execute({
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
