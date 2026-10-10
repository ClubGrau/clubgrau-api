import { GetIndicationCatalogResultDto } from '@modules/indications/application/dtos/get-indication-catalog.dto';
import { GetIndicationCatalogPort } from '@modules/indications/application/ports/inbound/get-indication-catalog.port';
import {
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { GetIndicationCatalogRequest } from '../http/get-indication-catalog.request';

export class GetIndicationCatalogController extends BaseController<
  GetIndicationCatalogRequest,
  HttpErrorBody | HttpSuccessBody<GetIndicationCatalogResultDto>
> {
  constructor(private readonly getIndicationCatalog: GetIndicationCatalogPort) {
    super();
  }

  async handle(
    _request: GetIndicationCatalogRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetIndicationCatalogResultDto>>
  > {
    try {
      const result = await this.getIndicationCatalog.execute();

      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
