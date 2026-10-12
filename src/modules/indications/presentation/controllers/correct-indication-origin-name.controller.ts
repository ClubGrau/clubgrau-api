import { CorrectIndicationOriginNameResultDto } from '@modules/indications/application/dtos/correct-indication-origin-name.dto';
import { CorrectIndicationOriginNamePort } from '@modules/indications/application/ports/inbound/correct-indication-origin-name.port';
import {
  IndicationOriginNameTakenError,
  IndicationOriginNotFoundError,
} from '@modules/indications/domain/errors/indication.errors';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
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
import { CorrectIndicationOriginNameRequest } from '../http/correct-indication-origin-name.request';

export class CorrectIndicationOriginNameController extends BaseController<
  CorrectIndicationOriginNameRequest,
  HttpErrorBody | HttpSuccessBody<CorrectIndicationOriginNameResultDto>
> {
  constructor(
    private readonly correctIndicationOriginName: CorrectIndicationOriginNamePort,
  ) {
    super();
  }

  async handle(
    request: CorrectIndicationOriginNameRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<CorrectIndicationOriginNameResultDto>
    >
  > {
    try {
      const requiredFields = ['id', 'name'];

      const missingField = this.validationRequiredFields(
        request,
        requiredFields,
      );
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.correctIndicationOriginName.execute({
        id: request.id,
        name: request.name,
      });

      return ok({ id: result.id });
    } catch (error) {
      if (
        error instanceof InvalidNameError ||
        error instanceof IndicationOriginNotFoundError
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
