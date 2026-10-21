import { GetLinkableIndicationOriginsResultDto } from '@modules/indications/application/dtos/get-linkable-indication-origins.dto';
import { GetLinkableIndicationOriginsPort } from '@modules/indications/application/ports/inbound/get-linkable-indication-origins.port';
import {
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { GetLinkableIndicationOriginsRequest } from '../http/get-linkable-indication-origins.request';

export class GetLinkableIndicationOriginsController extends BaseController<
  GetLinkableIndicationOriginsRequest,
  HttpErrorBody | HttpSuccessBody<GetLinkableIndicationOriginsResultDto>
> {
  constructor(
    private readonly getLinkableIndicationOrigins: GetLinkableIndicationOriginsPort,
  ) {
    super();
  }

  async handle(
    _request: GetLinkableIndicationOriginsRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<GetLinkableIndicationOriginsResultDto>
    >
  > {
    try {
      const result = await this.getLinkableIndicationOrigins.execute();

      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
