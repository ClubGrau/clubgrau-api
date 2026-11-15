import { LivenessDto } from '@modules/health/application/dtos/liveness.dto';
import { CheckLivenessPort } from '@modules/health/application/ports/inbound/check-liveness.port';
import {
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class CheckLivenessController extends BaseController<
  Record<string, never>,
  HttpErrorBody | HttpSuccessBody<LivenessDto>
> {
  constructor(private readonly checkLiveness: CheckLivenessPort) {
    super();
  }

  async handle(
    _request: Record<string, never>,
  ): Promise<HttpResponse<HttpErrorBody | HttpSuccessBody<LivenessDto>>> {
    try {
      const result = await this.checkLiveness.execute();
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
